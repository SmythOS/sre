// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @smythos/sre
// ---------------------------------------------------------------------------
const mockStorageRead = vi.fn();
const mockStorageWrite = vi.fn();
const mockStorageDelete = vi.fn();
const mockStorageExists = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
        },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    agent: () => ({
                        getModels: vi.fn().mockResolvedValue({
                            'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                        }),
                    }),
                    requester: () => ({
                        getModels: vi.fn().mockResolvedValue({
                            'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                        }),
                    }),
                };
            },
            getAgentDataConnector() {
                return { setEphemeralAgentData: vi.fn() };
            },
            getLLMConnector() {
                return { user: () => ({ request: vi.fn(), streamRequest: vi.fn() }) };
            },
            getStorageConnector(providerId?: string) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            read: mockStorageRead,
                            write: mockStorageWrite,
                            delete: mockStorageDelete,
                            exists: mockStorageExists,
                        }),
                    }),
                    settings: {},
                };
            },
            getCacheConnector(providerId?: string) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            get: mockCacheGet,
                            set: mockCacheSet,
                            delete: vi.fn(),
                            exists: vi.fn(),
                            getTTL: vi.fn(),
                            updateTTL: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            getVectorDBConnector(providerId?: string) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: vi.fn().mockResolvedValue(true),
                            createNamespace: vi.fn(),
                            createDatasource: vi.fn().mockResolvedValue('doc-id'),
                            search: vi.fn().mockResolvedValue([]),
                            deleteDatasource: vi.fn(),
                            deleteNamespace: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            getSchedulerConnector(providerId?: string) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            add: vi.fn(),
                            list: vi.fn().mockResolvedValue([]),
                            get: vi.fn(),
                            pause: vi.fn(),
                            resume: vi.fn(),
                            delete: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('team-1') }; },
            getVaultConnector() { return { requester: () => ({ get: vi.fn(), listKeys: vi.fn() }) }; },
            init(type: string, providerId: string, name: string, settings: any) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: vi.fn().mockResolvedValue(true),
                            createNamespace: vi.fn(),
                            createDatasource: vi.fn().mockResolvedValue('doc-id'),
                            search: vi.fn().mockResolvedValue([]),
                        }),
                    }),
                    settings: {},
                };
            },
        },
        TConnectorService: { Storage: 'Storage', Cache: 'Cache', VectorDB: 'VectorDB', Scheduler: 'Scheduler' },
        TLLMProvider: { OpenAI: 'OpenAI', Anthropic: 'Anthropic' },
        TLLMEvent: {
            Content: 'content', End: 'end', Error: 'error',
            ToolCall: 'toolCall', ToolResult: 'toolResult', Usage: 'usage',
            ToolInfo: 'toolInfo', Interrupted: 'interrupted', Data: 'data',
        },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        AgentProcess: { load: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({ data: 'result' }) }) },
        AgentDataConnector: class {},
        DummyAccount: class DummyAccount {},
        BinaryInput: { from: vi.fn() },
        Conversation: class extends EventEmitter {
            ready = Promise.resolve(true);
            streamPrompt = vi.fn().mockResolvedValue('response');
            spec: any = null;
            constructor() { super(); }
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
        SmythFS: {
            Instance: { read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() },
            getInstance: vi.fn().mockReturnValue({ read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() }),
        },
        TStorageProvider: { default: 'default', LocalStorage: 'LocalStorage' },
        TVectorDBProvider: { default: 'default', RAMVec: 'RAMVec' },
        TSchedulerProvider: { default: 'default', LocalScheduler: 'LocalScheduler' },
        TCacheProvider: { default: 'default', RAM: 'RAM' },
        Scope: { TEAM: 'team', AGENT: 'agent' },
    };
});

import { Agent } from '../../../src/Agent/Agent.class';
import { Scope } from '../../../src/types/SDKTypes';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Agent - Provider getters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── LLM ─────────────────────────────────────────────────────────────

    describe('llm', () => {
        it('returns provider factories keyed by provider name', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.llm).toHaveProperty('OpenAI');
            expect(typeof agent.llm.OpenAI).toBe('function');
        });

        it('returns same object on repeated access (lazy init)', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const llm1 = agent.llm;
            const llm2 = agent.llm;
            expect(llm1).toBe(llm2);
        });

        it('factory creates LLMInstance from string model ID', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const instance = agent.llm.OpenAI('gpt-4o');
            expect(instance).toBeDefined();
            expect(typeof instance.prompt).toBe('function');
        });

        it('factory creates LLMInstance from params object', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const instance = agent.llm.OpenAI({ model: 'gpt-4o', temperature: 0.5 });
            expect(instance).toBeDefined();
        });
    });

    // ── Storage ─────────────────────────────────────────────────────────

    describe('storage', () => {
        it('returns provider factories', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.storage).toHaveProperty('default');
            expect(agent.storage).toHaveProperty('LocalStorage');
        });

        it('returns same object on repeated access', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.storage).toBe(agent.storage);
        });

        it('factory returns a StorageInstance', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const storage = agent.storage.LocalStorage();
            expect(storage).toBeDefined();
            expect(typeof storage.read).toBe('function');
            expect(typeof storage.write).toBe('function');
        });

        it('uses agent candidate when agent has explicit ID', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const storage = agent.storage.LocalStorage();
            // Should not warn - agent has explicit id
            expect(storage).toBeDefined();
        });

        it('warns for ephemeral agent without TEAM scope', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' }); // ephemeral
            agent.storage.LocalStorage();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('does not warn when using Scope.TEAM', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            agent.storage.LocalStorage({ scope: Scope.TEAM });
            expect(warnSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('only warns once per provider type', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            agent.storage.LocalStorage();
            agent.storage.LocalStorage(); // second call, same agent
            // Should only warn once
            const storageCalls = warnSpy.mock.calls.filter(c => String(c[0]).includes('storage'));
            expect(storageCalls.length).toBe(1);
            warnSpy.mockRestore();
        });
    });

    // ── Cache ───────────────────────────────────────────────────────────

    describe('cache', () => {
        it('returns provider factories', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.cache).toHaveProperty('RAM');
        });

        it('returns same object on repeated access', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.cache).toBe(agent.cache);
        });

        it('factory returns a CacheInstance', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const cache = agent.cache.RAM();
            expect(cache).toBeDefined();
            expect(typeof cache.get).toBe('function');
            expect(typeof cache.set).toBe('function');
        });

        it('warns for ephemeral agent', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            agent.cache.RAM();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ── VectorDB ────────────────────────────────────────────────────────

    describe('vectorDB', () => {
        it('returns provider factories', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.vectorDB).toHaveProperty('RAMVec');
        });

        it('returns same object on repeated access', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.vectorDB).toBe(agent.vectorDB);
        });

        it('factory creates VectorDBInstance with namespace', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const vdb = agent.vectorDB.RAMVec('my-namespace');
            expect(vdb).toBeDefined();
            expect(typeof vdb.insertDoc).toBe('function');
            expect(typeof vdb.search).toBe('function');
        });

        it('warns for ephemeral agent', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            agent.vectorDB.RAMVec('ns');
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ── Scheduler ───────────────────────────────────────────────────────

    describe('scheduler', () => {
        it('returns provider factories', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.scheduler).toHaveProperty('LocalScheduler');
        });

        it('returns same object on repeated access', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.scheduler).toBe(agent.scheduler);
        });

        it('factory creates SchedulerInstance', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const sched = agent.scheduler.LocalScheduler();
            expect(sched).toBeDefined();
            expect(typeof sched.add).toBe('function');
        });

        it('warns for ephemeral agent', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            agent.scheduler.LocalScheduler();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ── Vault ───────────────────────────────────────────────────────────

    describe('vault', () => {
        it('returns a VaultInstance', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const vault = agent.vault;
            expect(vault).toBeDefined();
            expect(typeof vault.get).toBe('function');
        });

        it('returns same instance on repeated access (lazy)', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(agent.vault).toBe(agent.vault);
        });
    });
});
