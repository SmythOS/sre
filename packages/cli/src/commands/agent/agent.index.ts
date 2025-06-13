import { AccessCandidate, AgentProcess, AgentRequest, ConnectorService, SRE } from '@smythos/sre';
import path from 'path';
import os from 'os';
import fs from 'fs';
import * as util from 'util';
import { startLocalApp } from './chat/app';
import { parseParams } from '../../utils/params.utils';
//import { startMcpServer } from './mcp/app';

export default async function runAgent(options: any) {
    const chatModel = options.chat && typeof options.chat == 'string' ? options.chat : 'claude-3.7-sonnet';
    //console.log('Using LLM Model:', chatModel);
    // Modified validation: Only require post/get when endpoint is specified
    if (options.endpoint && !options.post && !options.get) {
        console.error('Error: Either --post or --get must be specified when using --endpoint');
        process.exit(1);
    }

    // Setup data path
    const dataPath = options.dataPath || path.join(os.tmpdir(), '/.smyth');
    if (!fs.existsSync(dataPath)) {
        console.debug(`Creating data directory: ${dataPath}`);
        fs.mkdirSync(dataPath, { recursive: true });
    }
    process.env.DATA_PATH = dataPath;

    const absVaultPath = options.vault ? path.resolve(process.cwd(), options.vault) : undefined;
    const absVaultKeyPath = options.vaultKey ? path.resolve(process.cwd(), options.vaultKey) : undefined;

    const absAgentDirectory = options.agent ? path.dirname(path.resolve(process.cwd(), options.agent)) : undefined;

    const modelsPath = options.models ? path.resolve(process.cwd(), options.models) : undefined;
    //const absModelsPath = options.models ? path.resolve(process.cwd(), options.models) : undefined;

    //const modelsJSON = absModelsPath ? JSON.parse(fs.readFileSync(absModelsPath, 'utf-8')) : undefined;

    try {
        // Initialize runtime
        const sre = SRE.init({
            CLI: {
                Connector: 'CLI',
            },
            Vault: {
                Connector: 'JSONFileVault',
                Settings: {
                    file: absVaultPath,
                    fileKey: absVaultKeyPath,
                    shared: true,
                },
            },
            Cache: {
                Connector: 'LocalStorage',
                Settings: { folder: dataPath },
            },
            Storage: {
                Connector: 'LocalStorage',
                Settings: { folder: dataPath },
            },

            Component: {
                Connector: 'LocalComponent',
            },
            ModelsProvider: {
                Connector: 'SmythModelsProvider',
                Settings: {
                    models: modelsPath,
                    mode: 'merge',
                },
            },
            AgentData: {
                Connector: 'Local',
                Settings: {
                    devDir: absAgentDirectory,
                    prodDir: absAgentDirectory,
                },
            },

            Account: {
                Connector: 'DummyAccount',
                Settings: {},
            },
            Log: {
                Connector: 'ConsoleLog',
            },
        });

        await sre.ready();

        const componentConnector = ConnectorService.getComponentConnector();
        // Load and run agent
        const agentData = JSON.parse(fs.readFileSync(options.agent, 'utf-8'));
        agentData.teamId = 'default';

        const modeHandler = {
            chat: executeChat,
            mcp: executeMCP,
            skill: executeSkill,
            endpoint: executeEndpoint,
        };

        const selectedModes = Object.keys(options).filter((e) => ['chat', 'skill', 'endpoint', 'mcp'].includes(e));

        if (selectedModes.length > 1) {
            console.error('Error: Only one mode can be specified: ', selectedModes.join(', '));
            process.exit(1);
        }

        const mode = selectedModes[0];
        if (mode) {
            const output = await modeHandler[mode](agentData, options);
            console.log(util.inspect(output?.data, { showHidden: false, depth: null, colors: true, maxArrayLength: null }));
        } else {
            console.log('no mode specified');
        }
    } catch (error) {
        console.error('Error:', error.message);

        process.exit(1);
    }
}

async function executeMCP(agentData: any, mcpName: string, params: any): Promise<any> {
    try {
        //startMcpServer(agentData, process.argv);
        console.log('not implemented');
    } catch (error) {
        console.error(`Error executing MCP '${mcpName}':`, error.message);
        throw error;
    }
}

async function executeChat(agentData: any, options: any): Promise<any> {
    const chatModel = options?.chat || 'gpt-4o';
    try {
        const randomPort = Math.floor(/*Math.random() * (65535 - 1024)) + 1024;*/ 5317);
        startLocalApp(randomPort, agentData, chatModel);
    } catch (error) {
        console.error(`Error executing chat '${chatModel}':`, error.message);
        throw error;
    }
}

async function executeSkill(agentData: any, options: any): Promise<any> {
    const skillName = options?.skill;
    try {
        const params = parseParams(options.input || '');

        const skill = agentData.components?.find((c: any) => c.name === 'APIEndpoint' && c.data.endpoint === skillName);
        const method = skill.data.method.toUpperCase();
        const path = `/api/${skillName}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        const body =
            method === 'POST'
                ? {
                      ...params,
                  }
                : undefined;
        const query =
            method === 'GET'
                ? {
                      ...params,
                  }
                : undefined;

        const agent = AgentProcess.load(agentData);
        return await agent.run({ method, path, body, query, headers });
    } catch (error) {
        console.error(`Error executing skill '${skillName}':`, error.message);
        throw error;
    }
}

async function executeEndpoint(agentData: any, endpoint: string, options: any): Promise<any> {
    try {
        // Build arguments for endpoint execution
        console.log(options);
    } catch (error) {
        console.error(`Error executing endpoint '${endpoint}':`, error.message);
        throw error;
    }
}

// Removed parseCLI function due to dependency issues
// This function had undefined dependencies and wasn't being used in the main execution flow
