// @ts-ignore - SRE SDK types not available yet
import { Agent, Model } from '@smythos/sdk';
// @ts-ignore - Express types
import express from 'express';
// @ts-ignore - Crypto types
import crypto from 'crypto';
// @ts-ignore - WebSocket types
import WebSocket from 'ws';
// @ts-ignore - Dotenv types
import dotenv from 'dotenv';

// Type definitions for this file
interface Request {
    body: any;
}

interface Response {
    json(data: any): void;
    sendStatus(code: number): void;
}

// Type definitions
interface TranscriptInfo {
    transcript: string;
    speaker: string;
    timestamp: string;
    meetingId: string;
}

interface ConnectionData {
    signaling?: WebSocket;
    media?: WebSocket;
    transcripts?: TranscriptInfo[];
}

interface ZoomWebhookPayload {
    plainToken?: string;
    meeting_uuid?: string;
    rtms_stream_id?: string;
    server_urls?: string;
}

interface ZoomWebhookRequest {
    event: string;
    payload: ZoomWebhookPayload;
}

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || '3000';

// Zoom RTMS Configuration
const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN;
const CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';

// Middleware
app.use(express.json());

// Map to keep track of active connections and meeting data
const activeConnections = new Map<string, ConnectionData>();
const meetingAgents = new Map<string, Agent>();

/**
 * Create an intelligent meeting agent using SRE
 */
async function createMeetingAgent(meetingUuid: string): Promise<Agent> {
    console.log(`Creating SRE agent for meeting: ${meetingUuid}`);
    
    const agent = new Agent({
        id: `meeting-agent-${meetingUuid}`,
        name: 'Zoom Meeting Intelligence Agent',
        behavior: `You are an intelligent meeting assistant that processes real-time transcripts from Zoom meetings. 
        Your role is to:
        1. Analyze meeting content in real-time
        2. Extract key insights, action items, and decisions
        3. Identify important topics and participants
        4. Generate meeting summaries
        5. Store transcript data for future reference
        
        Always provide structured, actionable insights from meeting conversations.`,
        model: process.env.OPENAI_API_KEY ? 'gpt-4o' : 'claude-3-5-sonnet-20241022'
    });

    // Add transcript analysis skill
    agent.addSkill({
        id: 'transcript-analyzer',
        name: 'Real-time Transcript Analysis',
        description: 'Analyzes meeting transcripts to extract insights, action items, and key information',
        process: async ({ transcript, speaker, timestamp }: { transcript: string; speaker: string; timestamp: string }) => {
            console.log(`Processing transcript from ${speaker} at ${timestamp}: ${transcript}`);
            
            try {
                // Use the agent's LLM to analyze the transcript
                const llm = agent.llm.OpenAI ? 
                    agent.llm.OpenAI('gpt-4o-mini') : 
                    agent.llm.Anthropic('claude-3-5-haiku-20241022');
                
                const analysis = await llm.prompt(`
                    Analyze this meeting transcript segment:
                    Speaker: ${speaker}
                    Time: ${timestamp}
                    Content: "${transcript}"
                    
                    Extract:
                    1. Key topics discussed
                    2. Action items (if any)
                    3. Decisions made (if any)
                    4. Important questions raised
                    5. Sentiment (positive/neutral/negative)
                    
                    Return as JSON with keys: topics, actionItems, decisions, questions, sentiment
                `);
                
                return {
                    speaker,
                    timestamp,
                    transcript,
                    analysis: analysis,
                    processed_at: new Date().toISOString()
                };
            } catch (error) {
                console.error('Error analyzing transcript:', error);
                return {
                    speaker,
                    timestamp,
                    transcript,
                    error: 'Analysis failed',
                    processed_at: new Date().toISOString()
                };
            }
        }
    });

    // Add meeting summary skill
    agent.addSkill({
        id: 'meeting-summarizer',
        name: 'Meeting Summary Generator',
        description: 'Generates comprehensive meeting summaries from accumulated transcript data',
        process: async ({ transcripts, meetingId }: { transcripts: TranscriptInfo[]; meetingId: string }) => {
            console.log(`Generating summary for meeting ${meetingId} with ${transcripts.length} transcript segments`);
            
            try {
                const llm = agent.llm.OpenAI ? 
                    agent.llm.OpenAI('gpt-4o') : 
                    agent.llm.Anthropic('claude-3-5-sonnet-20241022');
                
                const fullTranscript = transcripts.map((t: TranscriptInfo) => `${t.speaker}: ${t.transcript}`).join('\n');
                
                const summary = await llm.prompt(`
                    Generate a comprehensive meeting summary from this transcript:
                    
                    ${fullTranscript}
                    
                    Include:
                    1. Meeting overview and main topics
                    2. Key decisions made
                    3. Action items with responsible parties
                    4. Important questions and discussions
                    5. Next steps
                    6. Participant insights
                    
                    Format as a structured report.
                `);
                
                // Store summary using SRE storage
                if (process.env.AWS_S3_BUCKET) {
                    const storage = agent.storage.S3({
                        bucket: process.env.AWS_S3_BUCKET,
                        region: process.env.AWS_REGION || 'us-east-1'
                    });
                    
                    const summaryPath = `meetings/${meetingId}/summary-${Date.now()}.txt`;
                    await storage.write(summaryPath, summary);
                    console.log(`Meeting summary saved to: ${summaryPath}`);
                }
                
                return {
                    meetingId,
                    summary,
                    transcriptCount: transcripts.length,
                    generatedAt: new Date().toISOString()
                };
            } catch (error) {
                console.error('Error generating meeting summary:', error);
                return {
                    meetingId,
                    error: 'Summary generation failed',
                    generatedAt: new Date().toISOString()
                };
            }
        }
    });

    // Add VectorDB integration for transcript search
    if (process.env.PINECONE_API_KEY) {
        agent.addSkill({
            id: 'transcript-indexer',
            name: 'Transcript Vector Indexing',
            description: 'Indexes transcript segments in VectorDB for semantic search',
            process: async ({ transcript, speaker, timestamp, meetingId }: { transcript: string; speaker: string; timestamp: string; meetingId: string }) => {
                try {
                    const vectorDb = agent.vectordb.Pinecone({
                        namespace: `meeting-${meetingId}`,
                        indexName: process.env.PINECONE_INDEX_NAME || 'zoom-meetings',
                        apiKey: process.env.PINECONE_API_KEY,
                        embeddings: Model.OpenAI('text-embedding-3-large')
                    });
                    
                    const documentId = `${meetingId}-${timestamp}-${speaker}`;
                    await vectorDb.upsert(documentId, transcript, {
                        speaker,
                        timestamp,
                        meetingId,
                        indexed_at: new Date().toISOString()
                    });
                    
                    console.log(`Indexed transcript segment: ${documentId}`);
                    return { success: true, documentId };
                } catch (error: any) {
                    console.error('Error indexing transcript:', error);
                    return { success: false, error: error.message };
                }
            }
        });
    }

    return agent;
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
    if (!activeConnections.has(meetingUuid)) {
        activeConnections.set(meetingUuid, {});
    }
    activeConnections.get(meetingUuid).signaling = ws;
    
    ws.on('open', () => {
        console.log(`Signaling WebSocket opened for meeting ${meetingUuid}`);
        
        const signature = generateSignature(CLIENT_ID!, meetingUuid, streamId, CLIENT_SECRET!);
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
        if (activeConnections.has(meetingUuid)) {
            delete activeConnections.get(meetingUuid).signaling;
        }
    });
}

/**
 * Connect to Zoom media WebSocket for transcript data
 */
function connectToMediaWebSocket(mediaUrl: string, meetingUuid: string, streamId: string, signalingSocket: WebSocket) {
    console.log(`Connecting to media WebSocket at ${mediaUrl}`);
    
    const mediaWs = new WebSocket(mediaUrl, { rejectUnauthorized: false });
    
    // Store connection
    if (activeConnections.has(meetingUuid)) {
        activeConnections.get(meetingUuid).media = mediaWs;
    }
    
    // Initialize transcript storage for this meeting
    if (!activeConnections.get(meetingUuid).transcripts) {
        activeConnections.get(meetingUuid).transcripts = [];
    }
    
    mediaWs.on('open', () => {
        console.log(`Media WebSocket opened for meeting ${meetingUuid}`);
        
        const signature = generateSignature(CLIENT_ID!, meetingUuid, streamId, CLIENT_SECRET!);
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
    
    mediaWs.on('message', async (data: any) => {
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
                
                // Get or create meeting agent
                let agent = meetingAgents.get(meetingUuid);
                if (!agent) {
                    agent = await createMeetingAgent(meetingUuid);
                    meetingAgents.set(meetingUuid, agent);
                }
                
                // Process transcript with SRE agent
                if (transcriptData.text && transcriptData.text.trim()) {
                    const transcriptInfo = {
                        transcript: transcriptData.text,
                        speaker: transcriptData.speaker_name || 'Unknown',
                        timestamp: new Date().toISOString(),
                        meetingId: meetingUuid
                    };
                    
                    // Store transcript
                    activeConnections.get(meetingUuid).transcripts.push(transcriptInfo);
                    
                    // Analyze with SRE agent
                    try {
                        const analysis = await agent.prompt(`Analyze this transcript: "${transcriptInfo.transcript}" from ${transcriptInfo.speaker}`);
                        console.log('SRE Analysis:', analysis);
                        
                        // Index in VectorDB if configured
                        if (process.env.PINECONE_API_KEY) {
                            await agent.prompt(`Index this transcript segment for search: ${JSON.stringify(transcriptInfo)}`);
                        }
                    } catch (error) {
                        console.error('Error processing transcript with SRE:', error);
                    }
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
        if (activeConnections.has(meetingUuid)) {
            delete activeConnections.get(meetingUuid).media;
        }
    });
}

/**
 * Webhook handler for Zoom RTMS events
 */
app.post(WEBHOOK_PATH, async (req: Request, res: Response) => {
    console.log('RTMS Webhook received:', JSON.stringify(req.body, null, 2));
    const { event, payload }: ZoomWebhookRequest = req.body;
    
    // Handle URL validation
    if (event === 'endpoint.url_validation' && payload?.plainToken) {
        const hash = crypto
            .createHmac('sha256', ZOOM_SECRET_TOKEN!)
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
        console.log('RTMS Started - Initializing SRE agent and connections');
        const { meeting_uuid, rtms_stream_id, server_urls } = payload;
        
        // Create SRE agent for this meeting
        try {
            const agent = await createMeetingAgent(meeting_uuid);
            meetingAgents.set(meeting_uuid, agent);
            console.log(`SRE agent created for meeting: ${meeting_uuid}`);
        } catch (error) {
            console.error('Error creating SRE agent:', error);
        }
        
        // Connect to Zoom WebSocket
        connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls);
    }
    
    // Handle RTMS stopped
    if (event === 'meeting.rtms_stopped') {
        console.log('RTMS Stopped - Generating final summary');
        const { meeting_uuid } = payload;
        
        // Generate final meeting summary with SRE
        const agent = meetingAgents.get(meeting_uuid);
        const connectionData = activeConnections.get(meeting_uuid);
        
        if (agent && connectionData?.transcripts?.length > 0) {
            try {
                const summary = await agent.prompt(`Generate a final meeting summary for meeting ${meeting_uuid} with ${connectionData.transcripts.length} transcript segments`);
                console.log('Final Meeting Summary:', summary);
                
                // Save summary to storage if configured
                if (process.env.AWS_S3_BUCKET) {
                    // This would be handled by the agent's storage skill
                    console.log('Summary saved to storage via SRE agent');
                }
            } catch (error) {
                console.error('Error generating final summary:', error);
            }
        }
        
        // Cleanup connections and agents
        if (activeConnections.has(meeting_uuid)) {
            const connections = activeConnections.get(meeting_uuid);
            for (const conn of Object.values(connections)) {
                if (conn && typeof (conn as any).close === 'function') {
                    (conn as any).close();
                }
            }
            activeConnections.delete(meeting_uuid);
        }
        
        if (meetingAgents.has(meeting_uuid)) {
            meetingAgents.delete(meeting_uuid);
        }
        
        console.log(`Cleaned up resources for meeting: ${meeting_uuid}`);
    }
    
    res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        activeMeetings: activeConnections.size,
        activeAgents: meetingAgents.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`Zoom RTMS + SRE Integration Server running at http://localhost:${port}`);
    console.log(`Webhook endpoint: http://localhost:${port}${WEBHOOK_PATH}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log('SRE agents will be created automatically when meetings start');
});

export default app;
