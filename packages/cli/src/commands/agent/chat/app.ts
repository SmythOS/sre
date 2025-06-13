import express from 'express';
import staticHTML from './staticPage';
import fs from 'fs';
import { Agent, Conversation, Logger } from '@smythos/sre';

const logger = Logger('CLI-CHAT');

let curRes;
let conversation;
export const startLocalApp = async (port: number, agentData, chatModel): Promise<void> => {
    const app = express();

    //handleConvEvents(conversation);

    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Basic health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/refresh', async (req, res) => {
        conversation = await createConversation(agentData, chatModel);
        res.status(200).json({ status: 'ok' });
    });

    app.get('/api/v1/chat/stream', (req, res) => {
        if (!conversation) {
            sendSseMessage(curRes, { _type: 'message', content: 'This conversation has expired, please refresh the page', message_id: '1' });
            return;
        }
        curRes = res;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const message = req.query.message as string;
        const stream = conversation.streamPrompt(message);
    });

    app.get('/', (req, res) => {
        //const staticContent = fs.readFileSync('./dist/app.html', 'utf8');
        const staticContent = staticHTML;
        res.send(staticContent);
    });

    // Start the server

    try {
        app.listen(port, () => {
            console.log(`Chat App is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        throw error;
    }
};

function handleConvEvents(conversation: Conversation) {
    conversation.on('content', (content) => {
        logger.log('>', content);
        sendSseMessage(curRes, { _type: 'message', content, message_id: '1' });
    });

    conversation.on('start', (content) => {
        // writing
        logger.log('Started ==============');
    });
    conversation.on('usage', (data) => {
        // writing
        //console.log('USAGE DATA ', data);
    });

    conversation.on('beforeToolCall', (info) => {
        logger.log('Tool Call:', info);
    });

    conversation.on('afterToolCall', async (info, functionResponse) => {
        logger.log('Tool Call Result:', info, functionResponse);
    });

    conversation.on('error', (error) => {
        logger.log('Error:', error);
    });

    conversation.on('end', async (content) => {
        logger.log('Ended ==============');
        sendSseMessage(curRes, { _type: 'end', content, message_id: '1' });
    });
}

function sendSseMessage(res, { _type, content, message_id }: { _type: string; content: string; message_id: string }) {
    if (!res) return;
    res.write(`event: ${_type || 'response'}\n`);
    res.write(`data: ${JSON.stringify({ _type, content, message_id })}\n\n`);
}

async function createConversation(spec, model) {
    console.log('creating conversation', model);
    const conv = new Conversation(model, spec, { experimentalCache: true, agentId: spec.id });
    await conv.ready;
    handleConvEvents(conv);
    conversation = conv;
    return conv;
}
