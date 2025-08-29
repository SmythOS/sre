/// <reference types="node" />
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import WebSocket from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || '3000';

// Zoom RTMS Configuration
const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN || '';
const CLIENT_ID = process.env.ZOOM_CLIENT_ID || '';
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || '';
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';

// Middleware
app.use(express.json());

// Simple in-memory storage for demo purposes
const activeMeetings = new Map();

/**
 * Simple transcript processor (placeholder for SRE integration)
 */
function processTranscript(transcript: string, speaker: string, meetingId: string) {
    console.log(`[${meetingId}] Processing transcript from ${speaker}: ${transcript}`);
    
    // This is where you would integrate with SRE Agent
    // For now, we'll just do simple keyword detection
    const actionItems = [];
    const decisions = [];
    
    if (transcript.toLowerCase().includes('action item') || transcript.toLowerCase().includes('todo')) {
        actionItems.push(transcript);
    }
    
    if (transcript.toLowerCase().includes('decide') || transcript.toLowerCase().includes('decision')) {
        decisions.push(transcript);
    }
    
    return {
        speaker,
        transcript,
        actionItems,
        decisions,
        timestamp: new Date().toISOString()
    };
}

/**
 * Generate HMAC signature for Zoom RTMS authentication
 */
function generateSignature(clientId: string, meetingUuid: string, streamId: string, clientSecret: string): string {
    const message = `${clientId},${meetingUuid},${streamId}`;
    return crypto.createHmac('sha256', clientSecret).update(message).digest('hex');
}

/**
 * Connect to Zoom signaling WebSocket
 */
function connectToSignalingWebSocket(meetingUuid: string, streamId: string, serverUrl: string) {
    console.log(`Connecting to signaling WebSocket for meeting ${meetingUuid}`);
    
    const ws = new WebSocket(serverUrl);
    
    // Store connection
    if (!activeMeetings.has(meetingUuid)) {
        activeMeetings.set(meetingUuid, { transcripts: [] });
    }
    activeMeetings.get(meetingUuid).signaling = ws;
    
    ws.on('open', () => {
        console.log(`Signaling WebSocket opened for meeting ${meetingUuid}`);
        
        const signature = generateSignature(CLIENT_ID, meetingUuid, streamId, CLIENT_SECRET);
        const handshake = {
            msg_type: 1, // SIGNALING_HAND_SHAKE_REQ
            protocol_version: 1,
            meeting_uuid: meetingUuid,
            rtms_stream_id: streamId,
            sequence: Math.floor(Math.random() * 1e9),
            signature,
        };
        
        ws.send(JSON.stringify(handshake));
        console.log('Sent handshake to signaling server');
    });
    
    ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        console.log('Signaling Message:', JSON.stringify(msg, null, 2));
        
        // Handle successful handshake
        if (msg.msg_type === 2 && msg.status_code === 0) {
            const mediaUrl = msg.media_server;
            if (mediaUrl) {
                connectToMediaWebSocket(mediaUrl, meetingUuid, streamId, ws);
            }
        }
        
        // Handle keep-alive
        if (msg.msg_type === 12) {
            ws.send(JSON.stringify({
                msg_type: 13,
                timestamp: msg.timestamp,
            }));
        }
    });
    
    ws.on('error', (err: any) => {
        console.error('Signaling socket error:', err);
    });
    
    ws.on('close', () => {
        console.log('Signaling socket closed');
    });
}

/**
 * Connect to Zoom media WebSocket for transcript data
 */
function connectToMediaWebSocket(mediaUrl: string, meetingUuid: string, streamId: string, signalingSocket: WebSocket) {
    console.log(`Connecting to media WebSocket at ${mediaUrl}`);
    
    const mediaWs = new WebSocket(mediaUrl, { rejectUnauthorized: false });
    
    // Store connection
    if (activeMeetings.has(meetingUuid)) {
        activeMeetings.get(meetingUuid).media = mediaWs;
    }
    
    mediaWs.on('open', () => {
        console.log(`Media WebSocket opened for meeting ${meetingUuid}`);
        
        const signature = generateSignature(CLIENT_ID, meetingUuid, streamId, CLIENT_SECRET);
        const handshake = {
            msg_type: 3, // DATA_HAND_SHAKE_REQ
            protocol_version: 1,
            meeting_uuid: meetingUuid,
            rtms_stream_id: streamId,
            signature,
            media_type: 8, // MEDIA_DATA_TRANSCRIPT
            payload_encryption: false,
        };
        
        mediaWs.send(JSON.stringify(handshake));
    });
    
    mediaWs.on('message', (data: any) => {
        try {
            const msg = JSON.parse(data.toString());
            
            // Handle successful media handshake
            if (msg.msg_type === 4 && msg.status_code === 0) {
                signalingSocket.send(JSON.stringify({
                    msg_type: 7, // CLIENT_READY_ACK
                    rtms_stream_id: streamId,
                }));
                console.log('Media handshake successful, ready to receive transcripts');
            }
            
            // Handle transcript data
            if (msg.msg_type === 5 && msg.payload) { // DATA_FRAME
                const transcriptData = msg.payload;
                console.log('Received transcript:', transcriptData);
                
                // Process transcript with simple analysis
                if (transcriptData.text && transcriptData.text.trim()) {
                    const analysis = processTranscript(
                        transcriptData.text,
                        transcriptData.speaker_name || 'Unknown',
                        meetingUuid
                    );
                    
                    // Store the analyzed transcript
                    activeMeetings.get(meetingUuid).transcripts.push(analysis);
                    
                    console.log('Transcript Analysis:', analysis);
                }
            }
            
            // Handle keep-alive
            if (msg.msg_type === 12) {
                mediaWs.send(JSON.stringify({
                    msg_type: 13,
                    timestamp: msg.timestamp,
                }));
            }
        } catch (err) {
            // Handle binary data (audio/video)
            console.log('Received binary media data (length):', data.length);
        }
    });
    
    mediaWs.on('error', (err: any) => {
        console.error('Media socket error:', err);
    });
    
    mediaWs.on('close', () => {
        console.log('Media socket closed');
    });
}

/**
 * Webhook handler for Zoom RTMS events
 */
app.post(WEBHOOK_PATH, (req: Request, res: Response) => {
    console.log('RTMS Webhook received:', JSON.stringify(req.body, null, 2));
    const { event, payload } = req.body;
    
    // Handle URL validation
    if (event === 'endpoint.url_validation' && payload?.plainToken) {
        const hash = crypto
            .createHmac('sha256', ZOOM_SECRET_TOKEN)
            .update(payload.plainToken)
            .digest('hex');
        
        console.log('Responding to URL validation challenge');
        return res.json({
            plainToken: payload.plainToken,
            encryptedToken: hash,
        });
    }
    
    // Handle RTMS started
    if (event === 'meeting.rtms_started') {
        console.log('RTMS Started - Connecting to Zoom streams');
        const { meeting_uuid, rtms_stream_id, server_urls } = payload;
        
        // Connect to Zoom WebSocket
        connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls);
    }
    
    // Handle RTMS stopped
    if (event === 'meeting.rtms_stopped') {
        console.log('RTMS Stopped - Generating meeting summary');
        const { meeting_uuid } = payload;
        
        const meetingData = activeMeetings.get(meeting_uuid);
        if (meetingData && meetingData.transcripts) {
            console.log(`Meeting ${meeting_uuid} Summary:`);
            console.log(`- Total transcripts: ${meetingData.transcripts.length}`);
            
            const allActionItems = meetingData.transcripts
                .flatMap((t: any) => t.actionItems)
                .filter((item: any) => item);
            
            const allDecisions = meetingData.transcripts
                .flatMap((t: any) => t.decisions)
                .filter((item: any) => item);
            
            console.log(`- Action items found: ${allActionItems.length}`);
            console.log(`- Decisions found: ${allDecisions.length}`);
            
            if (allActionItems.length > 0) {
                console.log('Action Items:');
                allActionItems.forEach((item: string, index: number) => {
                    console.log(`  ${index + 1}. ${item}`);
                });
            }
            
            if (allDecisions.length > 0) {
                console.log('Decisions:');
                allDecisions.forEach((item: string, index: number) => {
                    console.log(`  ${index + 1}. ${item}`);
                });
            }
        }
        
        // Cleanup
        if (activeMeetings.has(meeting_uuid)) {
            const connections = activeMeetings.get(meeting_uuid);
            if (connections.signaling) connections.signaling.close();
            if (connections.media) connections.media.close();
            activeMeetings.delete(meeting_uuid);
        }
        
        console.log(`Cleaned up resources for meeting: ${meeting_uuid}`);
    }
    
    res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        activeMeetings: activeMeetings.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`Simple Zoom RTMS Integration Server running at http://localhost:${port}`);
    console.log(`Webhook endpoint: http://localhost:${port}${WEBHOOK_PATH}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log('Ready to receive Zoom RTMS events');
});

export default app;
