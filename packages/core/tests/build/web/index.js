import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConnectorService, Conversation, SmythRuntime } from './sre/index.dev.js';
dotenv.config();
//(session);

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

const conversations = {};

const cliConnector = ConnectorService.getCLIConnector();
//const specUrl = cliConnector.params?.agent || 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
const model = cliConnector.params?.model || 'gpt-4o';

console.log("Model ===> ", model);

const maxContextSize = parseInt(cliConnector.params?.maxContextSize || 4096);
const maxOutputTokens = parseInt(cliConnector.params?.maxOutputTokens || 4096);
//const conv = new Conversation(model, specUrl, { maxContextSize, maxOutputTokens });

//implement a simple expressjs app that serves static files from ./static folder

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticPath = path.join(__dirname, 'static');

console.log('dirname:', staticPath);
console.log('Current working directory:', process.cwd());

app.use(express.json());

app.use((req, res, next) => {
    console.log('Received request:', req.method, req.url, ' Session:', req.sessionID);

    next();
});

app.get('/refresh', (req, res) => {
    const specUrl = req.query.specUrl || req.query.openapi || '';
    if (!specUrl) {
        res.status(400).send('Missing specUrl parameter');
        return;
    }

    console.log('Refreshing session:', req.sessionID);
    req.session.touch();
    //html code to delete cookie and redirect to home page
    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
        }
        delete conversations[req.sessionID];
        res.redirect('/?openapi=' + specUrl);
    });
});

app.use('/', express.static(staticPath));

app.post('/api/chat', async (req, res) => {
    try {
        console.log('Received chat request:', req.body);
        const { message, specUrl } = req.body;

        const conv = conversations?.[req.sessionID]?.[specUrl];

        if (!conv) {
            res.status(400).send('Conversation not found');
            return;
        }

        const response = await promptConversation(conv, message, (data) => {
            //console.log('Content:', content);
            res.write(JSON.stringify(data));
        });

        res.end();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});
app.get('/api/info', async (req, res) => {
    try {
        const specUrl = req.query.specUrl || '';
        if (!specUrl) {
            res.status(400).send('Missing specUrl parameter');
            return;
        }

        if (!conversations[req.sessionID]) {
            conversations[req.sessionID] = {};
        }
        if (!conversations[req.sessionID][specUrl]) {
            conversations[req.sessionID][specUrl] = new Conversation(model, specUrl, { maxContextSize, maxOutputTokens });
        }
        const conv = conversations[req.sessionID][specUrl];

        const status = await conv.ready.catch((error) => 'error');

        if (!conv || status === 'error') {
            res.status(400).send('Conversation not found');
            return;
        }

        let messages = conv?.context?.messages || [];

        messages = messages.map((message) => {
            const msg = JSON.parse(JSON.stringify(message));
            if (msg.role === 'user') {
                if (msg.content && typeof msg.content == 'string' && msg.content.startsWith('Say Hi and present')) {
                    return null;
                }

                if (Array.isArray(msg.content)) {
                    msg.content = msg.content.map((c) => {
                        if (c.type === 'tool_result') {
                            c.content = 'Tool result';
                        }
                    });
                    return msg;
                }
            }

            return msg;
        });

        res.json({ name: conv.assistantName, messages });
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

function promptConversation(conv, message, contentCallback) {
    return new Promise(async (resolve, reject) => {
        let streamResult = '';
        conv.on('content', (content) => {
            //console.log('Content:', content);
            streamResult += content;
            if (contentCallback) contentCallback({ content });
        });

        conv.on('start', (content) => {
            // writing
            console.log('Started ==============');
        });

        conv.on('beforeToolCall', (info) => {
            try {
                console.log('Before Tool Call:', info);

                if (contentCallback) contentCallback({ tool: info.tool, result: false });
            } catch (error) {}
        });

        conv.on('afterToolCall', async (info) => {
            try {
                console.log('After Tool Call:', info);
                if (contentCallback) contentCallback({ tool: info.tool, result: true });
            } catch (error) {}
        });

        conv.on('end', (content) => {
            console.log('Ended ==============');
            conv.removeAllListeners();
            conv.removeAllListeners();
            conv.removeAllListeners();
            conv.removeAllListeners();
            conv.removeAllListeners();
        });

        await conv.streamPrompt(message);

        resolve(streamResult);
    });
}

//http://localhost:3000/?openapi=https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json
