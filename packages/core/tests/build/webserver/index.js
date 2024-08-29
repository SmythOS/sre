import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ConnectorService, Conversation, SmythRuntime, AgentProcess } from './sre/index.dev.js';
dotenv.config();

/*
This webserver runs a default agent located at ./agents/sre-openai-LLMPrompt.smyth
you can test it by calling http://localhost:5555/api/say with a POST request and a body like:
{
    "message": "Write a poem about flowers"
}

you can replace the agent file with your own agent file and test it by calling the agent declared endpoints

*/

//==============
const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
    AgentData: {
        Connector: 'CLI',
    },
});

const app = express();
const port = process.env.PORT || 5555;
// Session configuration
const sessionConfig = {
    secret: 'session secret goes here 123 456', // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 1 day
    },
};
app.use(session(sessionConfig));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticPath = path.join(__dirname, 'static');
app.use('/', express.static(staticPath));

const agentFile = path.join(__dirname, './agents/sre-openai-LLMPrompt.smyth');

app.post('/api/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const body = req.body;
    try {
        const agentData = fs.readFileSync(agentFile, 'utf-8');
        const data = JSON.parse(agentData);

        const output = await AgentProcess.load(data).run({
            method: 'POST',
            path: `/api/${endpoint}`,
            body,
        });

        res.json(output?.data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const query = req.query;
    try {
        const agentData = fs.readFileSync(agentFile, 'utf-8');
        const data = JSON.parse(agentData);

        const output = await AgentProcess.load(data).run({
            method: 'GET',
            path: `/api/${endpoint}`,
            query,
        });

        res.json(output?.data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Server Error');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
