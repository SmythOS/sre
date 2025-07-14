import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Agent } from '@smythos/sdk';
import { startMcpServer } from '../../cli/src/commands/agent/mcp.cmd';
import {
  LocalComponentConnector,
  ConnectorService,
  AccessCandidate,
  SRE,
} from '@smythos/sre';

const WORKFLOWS_DIR = path.join(__dirname, '../workflows');

async function bootSRE() {
  if (process.env.NODE_ENV === 'test') {
    SRE.init();
    await SRE.ready();
    return;
  }
  // Initialize SRE using startMcpServer with a minimal agent
  const dummyAgent = {
    version: '1.0',
    data: { id: 'init', components: [], connections: [] },
  };
  await startMcpServer(dummyAgent, 'stdio', 0, {});
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

  const agent = Agent.import(workflow);
  try {
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
  const result = await agent.prompt(req.query.prompt as string || '').catch((e) => ({ error: e.message }));
  res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
  res.end();
});

app.get('/logs/:agentId', (req, res) => {
  const file = path.join(os.homedir(), '.smyth', 'logs', req.params.agentId, 'debug.jsonl');
  if (!fs.existsSync(file)) return res.json([]);
  const entries = fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  res.json(entries);
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
  startServer().catch(err => console.error(err));
}
