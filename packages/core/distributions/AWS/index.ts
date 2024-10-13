// AB
// npm run build:aws:prod
// node distributions/AWS/dist/aws.prod.js --port=9090 --agent=/Users/anthonybudd/Development/SmythOS/vault-test.smyth --vault=/Users/anthonybudd/Development/SmythOS/vault.json


import 'dotenv/config';
import createMemoryStore from 'memorystore';
import session from 'express-session';
import minimist from 'minimist';
import express from 'express';
import * as fs from 'fs';
import 'source-map-support/register.js';
import { SmythRuntime, AgentProcess } from '../../src/index';

//============== CLI Args ==============//
const argv = minimist(process.argv.slice(2));
if (argv['v']) {
    console.log('v1.0.4 SM');
    process.exit();
}
if (!argv['port']) throw Error('You must provide --port argument');
if (!argv['agent']) throw Error('You must provide --agent argument');
if (!fs.existsSync(argv['agent'])) throw Error(`${argv['agent']} does not exist`);

let Vault: any = {
    Connector: 'SecretsManager',
    Settings: {
        region: process.env.AWS_REGION,
    },
};
if (argv['vault']) {
    if (!fs.existsSync(argv['vault'])) throw Error(`${argv['vault']} does not exist`);
    Vault = {
        Connector: 'JSONFileVault',
        Settings: {
            file: argv['vault'],
        },
    };
}

//============== Runtime Configuration ==============//
SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME,
        },
    },
    Vault,
    AgentData: {
        Connector: 'CLI',
    },
    Account: {
        Connector: 'DummyAccount',
        Settings: {

        },
    },
});

//============== Express ==============//
const MemoryStore = createMemoryStore(session);
const app = express();
app.disable('x-powered-by');
app.use(express.json());

// Configure session middleware
// Set up session middleware
app.use(
    session({
        store: new MemoryStore({}),
        secret: 'session secret goes here 123 456', // Replace with your own secret key
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30, // 1 day
        },
    })
);
app.get('/_healthcheck', (_, res) => res.send('healthy'));
app.get('/version', (_, res) => res.json({ version: 'v1.0.3' }));

const handleRequest = async (req: express.Request, res: express.Response) => {
    try {
        const { endpoint } = req.params;
        const query = req.query;
        const agentData = fs.readFileSync(argv['agent'], 'utf-8');
        const data = JSON.parse(agentData);
        const output = await AgentProcess.load(data).run({
            method: req.method,
            path: `/api/${endpoint}`,
            query,
        });
        res.json(output?.data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
};

app.get('/api/:endpoint', handleRequest);
app.post('/api/:endpoint', handleRequest);
app.put('/api/:endpoint', handleRequest);
app.delete('/api/:endpoint', handleRequest);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).send('Server Error');
});

const port = argv['port'];
app.listen(port, () => console.log(`Server is running on port ${port}`));
