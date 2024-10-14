import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessCandidate, ConnectorService, Conversation, SmythRuntime, StorageConnector } from '../../src/index.ts';
import multer from 'multer';
import fs from 'fs';
dotenv.config();
//(session);

//==============
const app = express();
const port = process.env.PORT || 5555;
const BASE_URL = `http://localhost:${port}`;

const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Account: {
        Connector: 'DummyAccount',
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
            file: process.env.DATA_DIR + '/vault.json',
        },
    },
    AgentData: {
        Connector: 'CLI',
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
    ManagedVault: {
        Connector: 'SmythManagedVault',
        Id: 'oauth',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            vaultName: 'oauth',
        },
    },
    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
        },
    },
});

const conversations = {};

const cliConnector = ConnectorService.getCLIConnector();
const specUrl = process.env.AGENT_BUILDER_SPEC_URL;
const model = cliConnector.params?.model || 'claude-3.5-sonnet'; //'claude-3.5-sonnet'; //'llama3-groq-70b-8192-tool-use-preview';
const alternativeModel = cliConnector.params?.alt || 'gpt-4o-mini';
const maxContextSize = parseInt(cliConnector.params?.maxContextSize || 42 * 1024);
const maxOutputTokens = parseInt(cliConnector.params?.maxOutputTokens || 8 * 1024);

console.log('Model ===> ', model, alternativeModel);

app.use(express.json());

//logger
app.use((req, res, next) => {
    console.log('Received request:', req.method, req.url, ' Session:', req.sessionID);
    next();
});

function calculateCost(usage, model) {
    let prompt_tokens_cost = 2.5;
    let cached_prompt_tokens_cost = 1.25;
    let completion_tokens_cost = 10;

    if (model.includes('claude-3.5-sonnet')) {
        prompt_tokens_cost = 3.75;
        cached_prompt_tokens_cost = 0.3;
        completion_tokens_cost = 15;
    }
    if (model.includes('claude-3-haiku')) {
        prompt_tokens_cost = 0.3;
        cached_prompt_tokens_cost = 0.03;
        completion_tokens_cost = 1.25;
    }
    if (model.includes('gpt-4o-mini')) {
        prompt_tokens_cost = 0.15;
        cached_prompt_tokens_cost = 0.075;
        completion_tokens_cost = 0.6;
    }
    if (model.includes('gpt-4o') && !model.includes('mini')) {
        prompt_tokens_cost = 2.5;
        cached_prompt_tokens_cost = 1.25;
        completion_tokens_cost = 10;
    }

    const prompt_tokens = usage.prompt_tokens - usage.prompt_tokens_details.cached_tokens;
    const completion_tokens = usage.completion_tokens;
    const cached_prompt_tokens = usage.prompt_tokens_details.cached_tokens;

    const total_cost =
        (prompt_tokens * prompt_tokens_cost + completion_tokens * completion_tokens_cost + cached_prompt_tokens * cached_prompt_tokens_cost) /
        1000000;
    return total_cost;
}

const usageTemplate = {
    total_messages: 0,
    estimated_cost: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    prompt_tokens_details: { cached_tokens: 0 },
    completion_tokens_details: { reasoning_tokens: 0 },
};

const internalTools = [
    {
        name: 'getSelection',
        description: `Use this function if you just need to see the user selected components.Always call this function if the user seems to refer to an existing content (e.g : "this is not working", "there is a missing connection in this workflow", ....`,
        arguments: {},
        handler: async (args) => {
            return { data: 'v10.0.22', error: null };
        },
    },
    {
        name: 'getAgentData',
        description: `Use this function if you just need to see the user selected components.Always call this function if the user seems to refer to an existing content (e.g : "this is not working", "there is a missing connection in this workflow", ....`,
        arguments: {},
        handler: async (args) => {
            return { data: 'v10.0.22', error: null };
        },
    },
];
function overrideContextWindow(llmContext, conversationId) {
    const originalGetContextWindow = llmContext.getContextWindow.bind(llmContext);
    llmContext.getContextWindow = async (...args) => {
        const contextWindow = await originalGetContextWindow(...args);
        const agentADL = conversations[conversationId].agentData;
        const selectionADL = conversations[conversationId].selection;
        const maxADLTokens = 20000;

        const agentADLText = `
==========================
# Current Agent ADL : This is the current agent loaded in the workspace.
# This does not represent the user selected portion of the agent.
${agentADL}`;

        //append agent ADL to system promptif it does not exceed the max tokens
        if (agentADL && agentADLText.length / 3 < maxADLTokens) {
            if (llmContext.model.includes('claude')) {
                if (typeof contextWindow[0].content === 'string') {
                    contextWindow[0].content = [
                        {
                            type: 'text',
                            text: contextWindow[0].content,
                            cache_control: { type: 'ephemeral' },
                        },
                    ];
                }
                contextWindow[0].content.push({
                    type: 'text',
                    text: agentADLText,
                    cache_control: { type: 'ephemeral' },
                });
            } else {
                contextWindow[0].content += agentADLText;
            }
        }
        // ==========================
        // # Current User Selection
        // ${selectionADL}
        // `;

        return contextWindow;
    };
}

class LLMMemoryStore {
    private _conversationId: string;
    private _memory: { messages: any[] };
    constructor(conversationId: string) {
        this._conversationId = conversationId;
        this._memory = { messages: [] };
    }
    async save(messages) {
        this._memory.messages = messages;
    }
    async load() {
        return this._memory.messages;
    }
    async getMessage(message_id) {
        return this._memory.messages.filter((m) => m?.__smyth_data__?.message_id === message_id);
    }
}

async function createConversation(conversationId) {
    const store = new LLMMemoryStore(conversationId);
    conversations[conversationId] = {
        curModel: model,
        advModelUse: 5,
        usage: JSON.parse(JSON.stringify(usageTemplate)),
        initialToolCall: false,
    };
    const toolsStrategy = (toolsConfig) => {
        let tool_choice = conversations[conversationId].curModel.includes('claude') ? { type: 'auto' } : 'auto';
        if (!conversations[conversationId].initialToolCall) {
            tool_choice = conversations[conversationId].curModel.includes('claude') ? { type: 'any' } : 'required';
            conversations[conversationId].initialToolCall = true;
        }
        toolsConfig = { ...toolsConfig, tool_choice };
        return toolsConfig;
    };
    const conv = new Conversation(model, specUrl, { maxContextSize, maxOutputTokens, store, experimentalCache: true, toolsStrategy });
    await conv.ready;
    conversations[conversationId].conv = conv;
    overrideContextWindow(conv.context, conversationId);
}

//const upload = multer({ dest: 'uploads/' }); // Files are stored in "uploads" directory

// app.post('/api/chat/upload', upload.single('file'), (req, res) => {
//     try {
//         const { message } = req.body;
//         const file = req.file;

//         console.log('Message:', message);

//         if (file) {
//             console.log('File received:', file.originalname);
//             // Move the file to a specific folder, or handle it as needed
//             const targetPath = path.join(__dirname, 'uploads', file.originalname);

//             fs.rename(file.path, targetPath, (err) => {
//                 if (err) throw err;
//                 console.log('File saved successfully!');
//             });
//         }

//         res.json({ success: true, message: 'File and message received' });
//     } catch (error) {
//         console.error('Error handling file:', error);
//         res.status(500).json({ success: false, message: 'Error processing file' });
//     }
// });

app.post('/api/chat/feedback', async (req, res) => {
    const { conversationId, feedback } = req.body;
    if (feedback) {
        const feedbackType = feedback.upvote ? 'positive' : 'negative';
        try {
            const timestamp = Date.now();
            const feedbackFile = `agent-builder/feedback/${feedbackType}/${conversationId}-${timestamp}.json`;
            const teamCandidate = AccessCandidate.team('agent-builder-team');
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            await s3Storage.user(teamCandidate).write(feedbackFile, JSON.stringify(feedback, null, 2));
        } catch (e) {
            console.error('failed to save feedback:', e);
        }
        //console.log('voted:', conversationId, feedback);
    }
    //const messages = await conversations[conversationId].store.getMessage(message_id);
    //console.log('Feedback:', conversationId, message_id, feedback, messages);
    res.json({ success: true });
});

app.post('/api/chat/refresh', async (req, res) => {
    console.log('Refreshing conversation:', req.body);
    try {
        const { conversationId } = req.body;
        await createConversation(conversationId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, agentData, selection, conversationId } = req.body;

        if (!conversations[conversationId]?.conv) {
            await createConversation(conversationId);
        }

        if (agentData) {
            conversations[conversationId].agentData = JSON2ADL(agentData);
            conversations[conversationId].selection = '[SELECTION IS EMPTY]';
        }
        if (selection && Array.isArray(selection)) {
            //conversations[reqId].selection = selection;

            try {
                const components = agentData.components.filter((c) => selection.includes(c.id));
                const connections = agentData.connections.filter((c) => selection.includes(c.sourceId) || selection.includes(c.targetId));

                const newAgentJson = {
                    components,
                    connections,
                };

                conversations[conversationId].selection = JSON2ADL(newAgentJson);
                if (!conversations[conversationId].selection.trim()) {
                    conversations[conversationId].selection = '[SELECTION IS EMPTY]';
                }
            } catch (error) {}
        }
        //console.log('agentData:', conversations[reqId].agentData);

        //console.log('Selection:', conversations[reqId].selection);

        //console.log('Received chat request:', req.body);

        const conv = conversations?.[conversationId]?.conv;

        if (!conv) {
            res.status(400).send('Conversation not found');
            return;
        }

        const response = await promptConversation(
            conversationId,
            message,
            (data) => {
                //console.log('Content:', content);
                res.write(JSON.stringify(data) + '¨');
            },
            (usageData) => {
                const usage = conversations[conversationId].usage;
                console.log('Usage Data:', conversationId, '=>', usageData);
                usage.total_messages++;
                for (let ud of usageData) {
                    usage.prompt_tokens += ud?.prompt_tokens || 0;
                    usage.completion_tokens += ud?.completion_tokens || 0;
                    usage.total_tokens += ud?.total_tokens || 0;
                    usage.prompt_tokens_details.cached_tokens += ud?.prompt_tokens_details?.cached_tokens || 0;
                    usage.completion_tokens_details.reasoning_tokens += ud?.completion_tokens_details?.reasoning_tokens || 0;
                }
                usage.estimated_cost = calculateCost(usage, conversations[conversationId].curModel);

                console.log('Total Usage:', conversationId, '=>', usage);
            }
        );

        res.end();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/_internal/getSelection', async (req, res) => {
    try {
        const conversationId = req.query.conversationId;
        if (!conversationId) {
            res.json({ info: 'Cannot Get Selection, please provide conversation id' });
            return;
        }
        const selection = conversations?.[conversationId as string]?.selection;
        res.json({ selection });
    } catch (error) {
        res.json({ info: 'cannot detect selected components' });
    }
});

app.get('/api/_internal/getAgentData', async (req, res) => {
    try {
        const conversationId = req.query.conversationId;
        if (!conversationId) {
            res.json({ info: 'Cannot Get Agent Data, please provide conversation id' });
            return;
        }
        const agentData = conversations?.[conversationId as string]?.agentData;
        res.json({ agentData });
    } catch (error) {
        res.json({ info: 'cannot detect agent data' });
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

function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
}

const toolMessageMap = {
    agent_create: 'Preparing Agent Creation',
    agent_update: 'Preparing Agent Update',
    get_selection: 'Analyzing Selected Components',
    general_info: 'Analyzing Content',
    agent_postcheck: 'Performing Additional Checks',
    explain: 'Analyzing User Request',
};
function getToolMessage(toolName) {
    return toolMessageMap[toolName] || toolName;
}
function promptConversation(conversationId, message, contentCallback, usageCallback = (usageData) => {}) {
    return new Promise(async (resolve, reject) => {
        const conv = conversations?.[conversationId]?.conv;
        const message_id = uid();
        let streamResult = '';
        conv.on('content', (content) => {
            //console.log(content);
            streamResult += content;
            if (contentCallback) contentCallback({ content, message_id });
        });

        conv.on('start', (content) => {
            // writing
            console.log('Started ==============');
        });
        conv.on('usage', (data) => {
            // writing
            //console.log('USAGE DATA ', data);
            usageCallback(data);
        });

        conv.on('beforeToolCall', (info) => {
            try {
                console.log('Before Tool Call:', info);

                if (contentCallback) contentCallback({ id: 'main', content: getToolMessage(info?.tool?.name), result: false, _type: 'status' });
            } catch (error) {}
        });

        conv.on('afterToolCall', async (info, functionResponse) => {
            try {
                //console.log('After Tool Call:', functionResponse);
                if (contentCallback) contentCallback({ id: 'main', content: 'Getting ready ...', _type: 'status' });
            } catch (error) {}
        });

        conv.on('error', (error) => {
            console.log('Error:', error);
            if (contentCallback) contentCallback({ id: conversationId, content: '[An Error Occured] ', result: false, _type: 'error' });
        });

        conv.on('end', async (content) => {
            console.log('Ended ==============');
            conversations[conversationId].initialToolCall = false; // reset the state in order to force calling tool in the next message
            conv.removeAllListeners();

            if (conversations?.[conversationId]?.advModelUse <= 0) {
                if (conversations?.[conversationId]?.curModel == model) {
                    console.log('Switching to alternative model:', alternativeModel);
                    conversations[conversationId].curModel = alternativeModel;
                    await conv.updateModel(alternativeModel);
                    overrideContextWindow(conv.context, conversationId);
                }
            } else {
                conversations[conversationId].advModelUse--;
            }
        });

        await conv.streamPrompt(message, { 'x-conversation-id': conversationId });

        resolve(streamResult);
    });
}

function JSON2ADL(jsonString) {
    const agentData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let adl = '';

    // Create agent
    adl += 'CREATE AGENT\n';
    adl += `NAME = "${agentData.name || agentData?.templateInfo?.name || ''}"\n`;
    adl += `DESCRIPTION = "${agentData.description || ''}"\n`;
    adl += `BEHAVIOR = "${agentData.behavior || ''}"\n\n`;

    // Components
    agentData.components.forEach((component) => {
        adl += `INSERT COMPONENT ${component.name} ID=${component.id}\n`;
        adl += `TITLE = "${component.title || ''}"\n`;
        adl += `DESCRIPTION = "${component.description || ''}"\n`;
        // Replace POS with separate LEFT and TOP
        adl += `LEFT = ${parseInt(component.left)}\n`;
        adl += `TOP = ${parseInt(component.top)}\n`;

        // Settings
        if (Object.keys(component.data).length > 0) {
            const settings = JSON.parse(JSON.stringify(component.data));
            //strip empty values
            const strippedSettings = Object.fromEntries(
                Object.entries(settings).filter(([key, value]) => value !== '' && value !== null && value !== undefined)
            );
            adl += `SETTINGS = ${JSON.stringify(strippedSettings)}\n`;
        }

        // Inputs
        if (component.inputs.length > 0) {
            const inputs = component.inputs
                .map((input) => {
                    let name = input.name;
                    if (input.optional) name += '?';
                    if (input.default) name += '*';
                    return `${name}:${input.type}`;
                })
                .join(', ');
            adl += `INPUTS = [${inputs}]\n`;
        }

        // Outputs
        if (component.outputs.length > 0) {
            const outputs = component.outputs
                .map((output) => {
                    let name = output.name;
                    if (output.optional) name += '?';
                    if (output.default) name += '*';
                    return `${name}:${output.type}`;
                })
                .join(', ');
            adl += `OUTPUTS = [${outputs}]\n`;
        }

        adl += 'COMMIT\n\n';
    });

    // Connections
    agentData.connections.forEach((connection) => {
        const sourceComponent = agentData.components.find((c) => c.id === connection.sourceId);
        const targetComponent = agentData.components.find((c) => c.id === connection.targetId);

        if (sourceComponent && targetComponent) {
            const sourceOutput = sourceComponent.outputs[connection.sourceIndex].name;
            const targetInput = targetComponent.inputs[connection.targetIndex].name;
            adl += `CONNECT ${connection.sourceId}:${sourceOutput} TO ${connection.targetId}:${targetInput}\n`;
        }
    });

    return adl.trim();
}
//http://localhost:3000/?openapi=https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json
