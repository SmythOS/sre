import Agent from '@sre/AgentManager/Agent.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
//We need SRE to be loaded because LLMAssistant uses internal SRE functions
const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
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
});
// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'agent-123456' }, // used inside inferBinaryType()
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
        });
    });
    return { default: MockedAgent };
});
describe('LLMAssistant: process function', () => {
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
                model: 'gpt-4o-mini',
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
        const input = { UserInput: 'Hi, my name is Smyth, who are you ?', UserId: '', ConversationId: 'SmythTestConversation0001' };

        config.inputs = [{ name: 'UserInput' }, { name: 'UserId' }, { name: 'ConversationId' }];

        let result = await llmAssistant.process(input, config, agent);

        expect(result.Response).toContain('Yohohohooooo!');

        input.UserInput = 'What is your prefered movie?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response).toContain('Yohohohooooo!');

        input.UserInput = 'Hi again, Do you remember my name ?';
        result = await llmAssistant.process(input, config, agent);
        expect(result.Response.toLowerCase()).toContain('smyth');
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
});
