import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Agent } from '@smythos/sdk';
import { startMcpServer } from '../../cli/src/commands/agent/mcp.cmd';
import { LocalComponentConnector, ConnectorService, AccessCandidate, SRE } from '@smythos/sre';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOWS_DIR = path.join(__dirname, '../workflows');

async function bootSRE() {
    // SRE initialization is now deferred to workflow execution or agent operations.
    return;
}

export async function createApp() {
    await bootSRE();

    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/components', async (_req, res) => {
        try {
            const connector = ConnectorService.getComponentConnector() as LocalComponentConnector;
            const requester = connector.requester(AccessCandidate.agent('studio-server'));
            const components = await requester.getAll();
            const componentDetails = Object.entries(components).map(([name, instance]: [string, any]) => ({
                name,
                settings: instance.schema?.settings || {},
                inputs: instance.schema?.inputs || {},
                outputs: instance.schema?.outputs || {},
            }));
            res.json(componentDetails);
        } catch (err: any) {
            console.error('Failed to load components', err);
            res.status(500).json({ error: 'failed to load components' });
        }
    });

    app.get('/workflows', (_req, res) => {
        const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.smyth'));
        res.json(files.map((f) => path.basename(f, '.smyth')));
    });

    app.get('/workflows/:name', (req, res) => {
        const file = path.join(WORKFLOWS_DIR, `${req.params.name}.smyth`);
        if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
        const agent = Agent.import(JSON.parse(fs.readFileSync(file, 'utf8')));
        res.json(agent.data);
    });

    app.post('/workflows/:name', (req, res) => {
        const file = path.join(WORKFLOWS_DIR, `${req.params.name}.smyth`);
        const agent = Agent.import(req.body);
        fs.writeFileSync(file, JSON.stringify(agent.export(), null, 2));
        res.json({ saved: true });
    });

    app.post('/execute', async (req, res) => {
        const { workflow, prompt, outputPaths } = req.body || {};
        if (!workflow) return res.status(400).json({ error: 'workflow required' });

        try {
            // Fetch free models from our own endpoint
            const freeModelsRes = await fetch('http://localhost:3010/free-models');
            if (!freeModelsRes.ok) {
                return res.status(502).json({ error: 'Failed to fetch free models for execution' });
            }
            const freeModels = await freeModelsRes.json();
            if (!Array.isArray(freeModels) || freeModels.length === 0) {
                return res.status(502).json({ error: 'No free models available for execution' });
            }
            // Select the first free model as primary, and use the rest as fallbacks
            const modelIds = freeModels.map(m => m.id);

            // Inject model(s) into the workflow/agent definition
            // This assumes the agent expects a 'model' or 'models' property at the top level or in settings
            // You may need to adjust this based on your agent schema
            if (workflow.model || workflow.models) {
                workflow.model = modelIds[0];
                workflow.models = modelIds;
            } else if (workflow.data) {
                workflow.data.model = modelIds[0];
                workflow.data.models = modelIds;
            }

            const agent = Agent.import(workflow);
            const result = await agent.prompt(prompt || '');
            if (outputPaths && typeof outputPaths === 'object') {
                for (const id of Object.keys(outputPaths)) {
                    const p = outputPaths[id];
                    try {
                        fs.mkdirSync(path.dirname(p), { recursive: true });
                        fs.writeFileSync(p, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
                    } catch (e) {
                        console.error('Failed to write output', e);
                    }
                }
            }
            res.json(result);
        } catch (err: any) {
            console.error('Failed to execute workflow', err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/run', async (req, res) => {
        const name = req.query.name as string;
        if (!name) return res.status(400).json({ error: 'name required' });
        const file = path.join(WORKFLOWS_DIR, `${name}.smyth`);
        if (!fs.existsSync(file)) return res.status(404).json({ error: 'Workflow not found' });
        const agent = Agent.import(JSON.parse(fs.readFileSync(file, 'utf8')));

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        agent.addSSE(res);
        const result = await agent.prompt((req.query.prompt as string) || '').catch((e) => ({ error: e.message }));
        res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
        res.end();
    });

    app.get('/logs/:agentId', (req, res) => {
        const file = path.join(os.homedir(), '.smyth', 'logs', req.params.agentId, 'debug.jsonl');
        if (!fs.existsSync(file)) return res.json([]);
        const entries = fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l));
        res.json(entries);
    });

    app.get('/free-models', async (req, res) => {
        try {
            const requiredParams = req.query.require_parameters
                ? req.query.require_parameters.split(',')
                : [];
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
            });
            if (!response.ok) {
                return res.status(502).json({ error: 'Failed to fetch models from OpenRouter' });
            }
            const data = await response.json();
            const freeModels = (data.data || []).filter(model => {
                const isFree = [
                    model.pricing?.prompt,
                    model.pricing?.completion,
                    model.pricing?.request,
                    model.pricing?.image,
                    model.pricing?.web_search,
                    model.pricing?.internal_reasoning
                ].every(val => val === '0');
                const hasParams = requiredParams.length === 0 || requiredParams.every(p => model.supported_parameters?.includes(p));
                return isFree && hasParams;
            });
            res.json(freeModels);
        } catch (err) {
            console.error('Failed to fetch free models', err);
            res.status(500).json({ error: 'Failed to fetch free models' });
        }
    });

    return app;
}

export async function startServer() {
    const app = await createApp();
    const PORT = Number(process.env.PORT) || 3010;
    return app.listen(PORT, () => {
        console.log(`Studio server listening on http://localhost:${PORT}`);
    });
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch((err) => console.error(err));
}
