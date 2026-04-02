/**
 * Worker Mode Web App — Express + SSE Server
 *
 * This example demonstrates Worker mode in a web UI with:
 * - A chat interface that streams assistant responses via SSE
 * - A right sidebar showing dispatched jobs and their live status
 * - Auto-surfaced results appearing as new assistant message blocks
 *
 * Run:
 *   npx tsx examples/100-webapp-worker-mode/server.ts
 *
 * Then open http://localhost:3000
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Agent, TAgentMode, TLLMEvent, Chat } from '@smythos/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Agent Setup ────────────────────────────────────────────────────────────

const agent = new Agent({
    id: 'worker-webapp-agent',
    name: 'Worker Web Agent',
    behavior: `You are a helpful assistant capable of handling both simple questions and complex research tasks.
For simple questions (math, facts, short answers), respond directly.
For complex multi-step tasks (research, analysis, code generation, comparisons), dispatch them to a background worker.
When presenting worker results to the user, format them clearly with markdown.`,
    model: 'claude-sonnet-4-5',
    mode: TAgentMode.WORKER,
});

// Sample skill for workers
agent.addSkill({
    name: 'WebSearch',
    description: 'Search the web for information on a given topic',
    process: async ({ query }) => {
        // Simulated search — replace with a real API in production
        await new Promise((r) => setTimeout(r, 1500));
        return {
            results: [
                { title: `Result 1 for "${query}"`, snippet: `Detailed information about ${query} from source A.` },
                { title: `Result 2 for "${query}"`, snippet: `Another perspective on ${query} from source B.` },
                { title: `Result 3 for "${query}"`, snippet: `In-depth analysis of ${query} from source C.` },
            ],
        };
    },
});

// ─── Per-Client State ───────────────────────────────────────────────────────

interface Client {
    id: string;
    chat: Chat;
    sseRes: express.Response | null;
}

const clients: Map<string, Client> = new Map();
let clientIdCounter = 0;

// ─── Helper: Send SSE event to a client ─────────────────────────────────────

function sendSSE(client: Client, event: string, data: any) {
    if (!client.sseRes || client.sseRes.writableEnded) return;
    client.sseRes.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Helper: Wire up agent & chat events for a client ───────────────────────

function wireEvents(client: Client) {
    const { chat } = client;

    // Track whether a stream just ended so we can auto-send message_start
    // when new activity arrives (content or tool_call — whichever comes first).
    let streamEnded = true;

    function ensureMessageStart() {
        if (streamEnded) {
            sendSSE(client, 'message_start', { role: 'assistant' });
            streamEnded = false;
        }
    }

    chat.on(TLLMEvent.Content, (content: string) => {
        ensureMessageStart();
        sendSSE(client, 'content', { content });
    });

    chat.on(TLLMEvent.ToolCall, (toolCall: any) => {
        ensureMessageStart();
        const name = toolCall?.tool?.name || '';
        sendSSE(client, 'tool_call', {
            name,
            arguments: toolCall?.tool?.arguments,
        });
    });

    chat.on(TLLMEvent.End, () => {
        streamEnded = true;
        sendSSE(client, 'end', {});
    });

    chat.on(TLLMEvent.Error, (error: any) => {
        sendSSE(client, 'error', { error: error?.message || String(error) });
    });

    chat.on(TLLMEvent.ToolResult, (toolResult: any) => {
        const name = toolResult?.tool?.name || '';
        let result = toolResult?.result;
        // Stringify objects for display
        if (typeof result === 'object' && result !== null) {
            try { result = JSON.stringify(result, null, 2); } catch { result = String(result); }
        } else if (result !== undefined && result !== null) {
            result = String(result);
        }
        sendSSE(client, 'tool_result', { name, result: result || null });
    });
}

function wireWorkerEvents(client: Client) {
    // Worker lifecycle events → pushed to sidebar
    // Note: Worker events are emitted on the shared agent instance. In a multi-user
    // production app, you'd scope workers per-session or filter by jobId ownership.
    agent.on('WorkerDispatched', ({ jobId, task }) => {
        sendSSE(client, 'worker_dispatched', { jobId, task });
    });

    agent.on('WorkerStatusChanged', ({ jobId, status }) => {
        sendSSE(client, 'worker_status', { jobId, status });
    });

    agent.on('WorkerQuestion', ({ jobId, questionId, question }) => {
        sendSSE(client, 'worker_question', { jobId, questionId, question });
    });

    agent.on('WorkerCompleted', ({ jobId, result }) => {
        sendSSE(client, 'worker_completed', { jobId, result: (result || '').substring(0, 200) });
    });

    agent.on('WorkerFailed', ({ jobId, error }) => {
        sendSSE(client, 'worker_failed', { jobId, error });
    });

    agent.on('WorkerCancelled', ({ jobId }) => {
        sendSSE(client, 'worker_cancelled', { jobId });
    });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /api/session — create a new chat session
app.post('/api/session', (_req, res) => {
    const id = `client-${++clientIdCounter}`;
    const chat = agent.chat({ id: `web-worker-${id}-${Date.now()}`, persist: false });

    const client: Client = { id, chat, sseRes: null };
    clients.set(id, client);

    wireEvents(client);
    wireWorkerEvents(client);

    res.json({ clientId: id });
});

// GET /api/events/:clientId — SSE stream for a client
app.get('/api/events/:clientId', (req, res) => {
    const client = clients.get(req.params.clientId);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.write('\n'); // flush headers

    client.sseRes = res;

    req.on('close', () => {
        client.sseRes = null;
    });
});

// POST /api/chat/:clientId — send a user message
app.post('/api/chat/:clientId', (req, res) => {
    const client = clients.get(req.params.clientId);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Missing message' });
        return;
    }

    // Fire and forget — streaming happens via SSE
    // (message_start is auto-sent by the Content listener in wireEvents)
    client.chat
        .prompt(message)
        .stream()
        .catch((error) => {
            sendSSE(client, 'error', { error: error?.message || String(error) });
        });

    res.json({ ok: true });
});

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n  Worker Mode Web App running at http://localhost:${PORT}\n`);
});
