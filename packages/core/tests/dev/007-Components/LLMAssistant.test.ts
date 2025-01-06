import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Agent from '@sre/AgentManager/Agent.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { TLLMMessageRole } from '@sre/types/LLM.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { type LLMConnector } from '@sre/LLMManager/LLM.service/LLMConnector';

//We need SRE to be loaded because LLMAssistant uses internal SRE functions
const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    },
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    Vault: {
        Connector: 'SmythVault',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },
});

const TEAM_ID = 'cloilcrl9001v9tkguilsu8dx'; // Team ID of Forhad

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'cm0zjhkzx0dfvhxf81u76taiz' },
            teamId: { value: TEAM_ID },
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
        });
    });
    return { default: MockedAgent };
});

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';

function testProcessFunction(model) {
    let llmAssistant: LLMAssistant;
    let agent: Agent;
    let config: any;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        llmAssistant = new LLMAssistant();
        config = {
            name: 'LLMAssistant',
            inputs: [],
            data: {
                model,
                ttl: 5 * 60, // default expiration time for conversation cache
                behavior: `You are a friendly and funny assistant. It is absolutely mandatory that you start and finish every message with the exact phrase "${LLM_OUTPUT_VALIDATOR}". Failure to include "${LLM_OUTPUT_VALIDATOR}" at both the beginning and end of your response will result in an incorrect output. If you don't know an answer, simply say "I don't know". This requirement is non-negotiable and must be adhered to in every response.`,
            },
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it(
        'Conversation with no context - UserId and ConversationId are empty ',
        async () => {
            const input = { UserInput: 'What is your prefered movie?', UserId: '', ConversationId: '' };

            config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

            const result = await llmAssistant.process(input, config, agent);

            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2
    );

    it(
        'Conversation with context ',
        async () => {
            const input = { UserInput: 'Hi, my name is Smyth, who are you?', UserId: '', ConversationId: 'SmythTestConversation0001' };

            config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

            let result = await llmAssistant.process(input, config, agent);

            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);

            input.UserInput = 'What is LLM?';
            result = await llmAssistant.process(input, config, agent);
            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);

            input.UserInput = 'Hi again, Do you remember my name ?';
            result = await llmAssistant.process(input, config, agent);
            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);
            expect(result.Response).toContain('Smyth');
        },
        TIMEOUT * 5
    );

    it(
        'Conversation with context that expires',
        async () => {
            const input = { UserInput: 'Hi, my name is Smyth, who are you ?', UserId: '', ConversationId: 'SmythTestConversation0002' };
            config.data.ttl = 10; // 10 seconds
            config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

            let result = await llmAssistant.process(input, config, agent);

            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);

            input.UserInput = 'What is your prefered movie?';
            result = await llmAssistant.process(input, config, agent);
            expect(result.Response).toContain(LLM_OUTPUT_VALIDATOR);

            await delay(15 * 1000); // wait for the conversation context to expire

            input.UserInput = 'Hi again, Do you remember my name ?';
            result = await llmAssistant.process(input, config, agent);
            expect(result.Response.toLowerCase().indexOf('smyth')).toBe(-1);
        },
        TIMEOUT * 5
    );
}

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini' },
    { provider: 'Anthropic', id: 'claude-3-haiku-20240307' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    { provider: 'Groq', id: 'gemma2-9b-it' },
    { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
    { provider: 'Bedrock', id: 'SRE - Bedrock with AI21 Labs - Jamba-Instruct' },
    { provider: 'Bedrock', id: 'SRE - Bedrock does not support System Prompt' },
    { provider: 'VertexAI', id: 'SRE - Vertex AI with Gemini Flash' },
];

models.forEach((model, index) => {
    describe(`LLMAssistant: test process function: ${model.provider} (${model.id})`, () => {
        testProcessFunction(model.id);
    });
});

describe('LLMAssistant: test process function with model switching', () => {
    it(
        'should switch models for the same conversation and maintain context',
        async () => {
            const llmAssistant = new LLMAssistant();
            // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
            const agent = new Agent();
            const conversationId = 'ModelSwitchingTest001';

            const config = {
                name: 'LLMAssistant',
                inputs: [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }],
                data: {
                    model: 'gpt-4o-mini',
                    ttl: 30 * models.length,
                    behavior: '',
                },
            };

            for (const model of models) {
                config.data.model = model.id;
                config.data.behavior = `You are an AI assistant specializing in different types of Large Language Models (LLMs). Follow these instructions:
                1. Begin and end every message with ${LLM_OUTPUT_VALIDATOR}
                2. Always include the name of the current model (${model.id}) in lowercase somewhere in your response.
                3. If you don't know something, simply say "I don't know" instead of guessing.
                4. Maintain context from previous messages in the conversation.
                5. Provide concise, accurate answers related to LLMs and general knowledge.
                6. Be friendly and engaging in your responses.`;

                const input = {
                    UserInput: `What is the provider of model ${model.id} and is it a good model?`,
                    UserId: '',
                    ConversationId: conversationId,
                };

                const result = await llmAssistant.process(input, config, agent);
                const response = result.Response;

                expect(response).toBeTruthy();
                expect(response).toContain(LLM_OUTPUT_VALIDATOR);
                expect(response.toLowerCase()).toContain(model.id.toLowerCase());
            }

            // Set up the final test with GPT-4
            config.data.model = 'gpt-4o-mini';
            config.data.behavior = `You are an AI assistant tasked with summarizing a conversation about various LLM models. Follow these instructions:
                1. Begin and end every message with ${LLM_OUTPUT_VALIDATOR}
                2. Provide a concise summary of the previous conversation, mentioning each model discussed.
                3. Include at least one strength or characteristic for each model mentioned.
                4. If you're unsure about any details, state "I'm not certain about [specific detail]" rather than guessing.
                5. Keep your response friendly and engaging.`;

            const input = {
                UserInput: `Summarize our conversation about the different LLM models we discussed.`,
                UserId: '',
                ConversationId: conversationId,
            };

            const result = await llmAssistant.process(input, config, agent);
            const response = result.Response;

            expect(response).toBeTruthy();
            expect(response).toContain(LLM_OUTPUT_VALIDATOR);
            expect(response.split(' ').length).toBeGreaterThan(20); // Ensure a substantial summary
        },
        TIMEOUT * (models.length + 1) // Additional 30 seconds for getting credentials of custom LLM
    );
});

describe('LLMAssistant: test getConsistentMessages()', () => {
    for (const model of models) {
        let llmConnector: LLMConnector;

        const isStandardLLM = LLMRegistry.isStandardLLM(model.id);

        if (isStandardLLM) {
            llmConnector = ConnectorService.getLLMConnector(model.provider);
        } else {
            llmConnector = ConnectorService.getLLMConnector(model.provider);
        }

        it(`should remove duplicate user messages at the beginning and end: ${model.provider} (${model.id})`, async () => {
            const content1 = 'Hello, how are you?';
            const content2 = 'Hello, how are you doing?';
            const content3 = 'I am fine, thank you!';
            const content4 = 'What can you do?';
            const content5 = '';

            const messages = [
                { role: TLLMMessageRole.User, content: content1 },
                { role: TLLMMessageRole.User, content: content2 }, // Duplicate at the beginning
                { role: TLLMMessageRole.Assistant, content: content3 },
                { role: TLLMMessageRole.User, content: content4 },
                { role: TLLMMessageRole.User, content: content5 }, // Duplicate at the end
            ];

            const consistentMessages = llmConnector.getConsistentMessages(messages);

            expect(consistentMessages).toHaveLength(messages.length - 2);

            expect(consistentMessages[0].role).toBe(TLLMMessageRole.User);
            expect(_getMessageContent(model.provider, consistentMessages[0])).toBe(content2);

            expect(consistentMessages[1].role).toBe(_getLLMMessageRole(model.provider));
            expect(_getMessageContent(model.provider, consistentMessages[1])).toBe(content3);

            expect(consistentMessages[2].role).toBe(TLLMMessageRole.User);
            expect(_getMessageContent(model.provider, consistentMessages[2])).toBe(content4);
        });
    }
});

function _getLLMMessageRole(provider): String {
    let role = '';

    if (provider === 'GoogleAI') {
        role = TLLMMessageRole.Model;
    } else {
        role = TLLMMessageRole.Assistant;
    }

    return role;
}

function _getMessageContent(provider, message): String {
    let content = '';

    if (['GoogleAI', 'VertexAI'].includes(provider)) {
        content = message?.parts?.[0]?.text;
    } else if (provider === 'Bedrock') {
        content = message?.content?.[0]?.text;
    } else {
        content = message?.content;
    }

    return content;
}
