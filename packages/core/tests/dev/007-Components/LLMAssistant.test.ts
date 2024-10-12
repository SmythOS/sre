import Anthropic from '@anthropic-ai/sdk';
import Agent from '@sre/AgentManager/Agent.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
    Account: {
        Connector: 'DummyAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
});
// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'cm0zjhkzx0dfvhxf81u76taiz' },
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
        });
    });
    return { default: MockedAgent };
});

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
                ttl: 5 * 60, //default expiration time for conversation cache
                behavior:
                    'You are a friendly and funny assistant, you answer any question but start and finish every message with "Yohohohooooo!"\nIMPORTANT: Don\'t prettend to know an information if you don\'t have it, just say "I don\'t know"',
            },
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it('Conversation with no context - UserId and ConversationId are empty ', async () => {
        const input = { UserInput: 'What is your prefered movie?', UserId: '', ConversationId: '' };

        config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

        const result = await llmAssistant.process(input, config, agent);

        expect(result.Response).toContain('Yohohohooooo!');
    });

    it('Conversation with context ', async () => {
        const input = { UserInput: 'Hi, my name is Smyth, who are you?', UserId: '', ConversationId: 'SmythTestConversation0001' };

        config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

        let result = await llmAssistant.process(input, config, agent);

        expect(result.Response).toContain('Yohohohooooo!');

        input.UserInput = 'What is your prefered movie?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response).toContain('Yohohohooooo!');

        input.UserInput = 'Hi again, Do you remember my name ?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response.toLowerCase()).toContain('yohohohooooo');
    });

    it('Conversation with context that expires', async () => {
        const input = { UserInput: 'Hi, my name is Smyth, who are you ?', UserId: '', ConversationId: 'SmythTestConversation0002' };
        config.data.ttl = 10; // 20 seconds
        config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

        let result = await llmAssistant.process(input, config, agent);

        expect(result.Response).toContain('Yohohohooooo!');

        input.UserInput = 'What is your prefered movie?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response).toContain('Yohohohooooo!');

        await delay(15 * 1000); // wait for the conversation context to expire

        input.UserInput = 'Hi again, Do you remember my name ?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response.toLowerCase().indexOf('smyth')).toBe(-1);
    }, 60000);
}

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini' },
    { provider: 'AnthropicAI', id: 'claude-3-5-sonnet-20240620' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    { provider: 'Groq', id: 'gemma2-9b-it' },
    { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
];

for (const model of models) {
    describe(`LLMAssistant: process function: ${model.provider} (${model.id})`, () => {
        testProcessFunction(model.id);
    });
}
