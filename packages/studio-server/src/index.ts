import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Agent } from '@smythos/sdk';
import { startMcpServer } from '../../cli/src/commands/agent/mcp.cmd';
// import { LocalComponentConnector } from '@sre/subsystems/AgentManager/Component.service/connectors/LocalComponentConnector.class';
// import { AccessRequest } from '@sre/subsystems/Security/AccessControl/AccessRequest.class';
// import { TAccessRole } from '@sre/types/ACL.types';

const WORKFLOWS_DIR = path.join(__dirname, '../workflows');

async function init() {
  // Initialize SRE using startMcpServer with a minimal agent
  const dummyAgent = { version: '1.0', data: { id: 'init', components: [], connections: [] } };
  await startMcpServer(dummyAgent, 'stdio', 0, {});
}

init().catch((err) => console.error(err));

const app = express();
app.use(cors());
app.use(express.json());

app.get('/components', async (_req, res) => {
  const componentsDir = path.resolve(__dirname, '../../core/src/Components');
  const componentFiles = fs.readdirSync(componentsDir);

  const componentDetails = componentFiles
    .filter(file => file.endsWith('.class.ts'))
    .map(file => {
      const name = path.basename(file, '.class.ts');
      return {
        name,
        description: `The ${name} component.`,
        inputs: [], 
      };
    });

  res.json(componentDetails);
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

const PORT = Number(process.env.PORT) || 3010;
app.listen(PORT, () => {
  console.log(`Studio server listening on http://localhost:${PORT}`);
});
