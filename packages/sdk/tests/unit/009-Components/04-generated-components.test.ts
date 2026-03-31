import { describe, it, expect, vi } from 'vitest';
import { APICall } from '../../../src/Components/generated/APICall';
import { APIOutput } from '../../../src/Components/generated/APIOutput';
import { Await } from '../../../src/Components/generated/Await';
import { Classifier } from '../../../src/Components/generated/Classifier';
import { ECMASandbox } from '../../../src/Components/generated/ECMASandbox';
import { FTimestamp } from '../../../src/Components/generated/FTimestamp';
import { GenAILLM } from '../../../src/Components/generated/GenAILLM';
import { HuggingFace } from '../../../src/Components/generated/HuggingFace';
import { ImageGenerator } from '../../../src/Components/generated/ImageGenerator';
import { MCPClient } from '../../../src/Components/generated/MCPClient';
import { ScrapflyWebScrape } from '../../../src/Components/generated/ScrapflyWebScrape';
import { ServerlessCode } from '../../../src/Components/generated/ServerlessCode';
import { TavilyWebSearch } from '../../../src/Components/generated/TavilyWebSearch';
import Components from '../../../src/Components/generated/index.generated';

// ---------------------------------------------------------------------------
// Helper: creates a mock agent for testing agent integration
// ---------------------------------------------------------------------------
function createMockAgent() {
    return {
        structure: { components: [] as any[], connections: [] },
        sync: vi.fn(),
    } as any;
}

// ---------------------------------------------------------------------------
// Generated Components Index
// ---------------------------------------------------------------------------
describe('Generated Components Index', () => {
    it('exports all 13 components', () => {
        const names = Object.keys(Components);
        expect(names).toHaveLength(13);
        expect(names).toEqual(
            expect.arrayContaining([
                'APICall', 'APIOutput', 'Await', 'Classifier', 'ECMASandbox',
                'FTimestamp', 'GenAILLM', 'HuggingFace', 'ImageGenerator',
                'MCPClient', 'ScrapflyWebScrape', 'ServerlessCode', 'TavilyWebSearch',
            ])
        );
    });
});

// ---------------------------------------------------------------------------
// APICall
// ---------------------------------------------------------------------------
describe('APICall', () => {
    it('returns object with out and in', () => {
        const comp = APICall({ method: 'GET', url: 'https://example.com' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
        expect(typeof comp.in).toBe('function');
    });

    it('creates ComponentWrapper with name "APICall"', () => {
        const comp = APICall({ method: 'POST', url: 'https://api.io' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('APICall');
        expect(wrapper.id).toMatch(/^C/);
    });

    it('passes settings through', () => {
        const comp = APICall({ method: 'PUT', url: 'https://api.io', proxy: 'http://proxy' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.method).toBe('PUT');
        expect(wrapper.data.data.url).toBe('https://api.io');
        expect(wrapper.data.data.proxy).toBe('http://proxy');
    });

    it('has Headers and Response outputs', () => {
        const comp = APICall({ method: 'GET', url: 'https://example.com' });
        expect(comp.out).toHaveProperty('Headers');
        expect(comp.out).toHaveProperty('Response');
        expect((comp.out.Headers as any).__path__).toBe('Headers');
        expect((comp.out.Response as any).__path__).toBe('Response');
    });

    it('pushes to agent and calls sync when agent provided', () => {
        const agent = createMockAgent();
        APICall({ method: 'GET', url: 'https://example.com' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// APIOutput
// ---------------------------------------------------------------------------
describe('APIOutput', () => {
    it('returns object with out and in', () => {
        const comp = APIOutput({ format: 'full' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "APIOutput"', () => {
        const comp = APIOutput({ format: 'raw' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('APIOutput');
    });

    it('passes settings through', () => {
        const comp = APIOutput({ format: 'minimal', contentType: 'text/plain' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.format).toBe('minimal');
        expect(wrapper.data.data.contentType).toBe('text/plain');
    });

    it('has no predefined named outputs', () => {
        const comp = APIOutput({ format: 'full' });
        const wrapper = (comp.out as any).__root__;
        // outputs are defined but empty (no named keys)
        expect(wrapper.data.outputs).toEqual([]);
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        APIOutput({ format: 'full' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// Await
// ---------------------------------------------------------------------------
describe('Await', () => {
    it('returns object with out and in', () => {
        const comp = Await({ jobs_count: 2 });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "Await"', () => {
        const comp = Await({ jobs_count: 3, max_time: 5000 });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('Await');
    });

    it('passes settings through', () => {
        const comp = Await({ jobs_count: 5, max_time: 10000 });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.jobs_count).toBe(5);
        expect(wrapper.data.data.max_time).toBe(10000);
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        Await({}, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------
describe('Classifier', () => {
    it('returns object with out and in', () => {
        const comp = Classifier({ model: 'gpt-4' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "Classifier"', () => {
        const comp = Classifier({ model: 'gpt-4' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('Classifier');
    });

    it('passes settings through', () => {
        const comp = Classifier({ model: 'gpt-4', prompt: 'Classify this' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.model).toBe('gpt-4');
        expect(wrapper.data.data.prompt).toBe('Classify this');
    });

    it('has Input in its declared inputs', () => {
        const comp = Classifier({ model: 'gpt-4' });
        const wrapper = (comp.out as any).__root__;
        const inputNames = wrapper.data.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('Input');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        Classifier({ model: 'gpt-4' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// ECMASandbox
// ---------------------------------------------------------------------------
describe('ECMASandbox', () => {
    it('returns object with out and in', () => {
        const comp = ECMASandbox({ code: 'return 42;' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "ECMASandbox"', () => {
        const comp = ECMASandbox({});
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('ECMASandbox');
    });

    it('passes settings through', () => {
        const comp = ECMASandbox({ code: 'console.log("hi")' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.code).toBe('console.log("hi")');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        ECMASandbox({ code: 'x' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// FTimestamp
// ---------------------------------------------------------------------------
describe('FTimestamp', () => {
    it('returns object with out and in', () => {
        const comp = FTimestamp({ format: 'unix' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "FTimestamp"', () => {
        const comp = FTimestamp({});
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('FTimestamp');
    });

    it('passes settings through', () => {
        const comp = FTimestamp({ format: 'iso' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.format).toBe('iso');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        FTimestamp({ format: 'timestamp' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// GenAILLM
// ---------------------------------------------------------------------------
describe('GenAILLM', () => {
    it('returns object with out and in', () => {
        const comp = GenAILLM({ model: 'gpt-4', prompt: 'Hello' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "GenAILLM"', () => {
        const comp = GenAILLM({ model: 'gpt-4', prompt: 'Test' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('GenAILLM');
    });

    it('passes settings through', () => {
        const comp = GenAILLM({ model: 'claude-3', prompt: 'Analyze', temperature: 0.7 });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.model).toBe('claude-3');
        expect(wrapper.data.data.prompt).toBe('Analyze');
        expect(wrapper.data.data.temperature).toBe(0.7);
    });

    it('has Reply output', () => {
        const comp = GenAILLM({ model: 'gpt-4', prompt: 'Hi' });
        expect(comp.out).toHaveProperty('Reply');
        expect((comp.out.Reply as any).__path__).toBe('Reply');
    });

    it('has Input and Attachment in its declared inputs', () => {
        const comp = GenAILLM({ model: 'gpt-4', prompt: 'Hi' });
        const wrapper = (comp.out as any).__root__;
        const inputNames = wrapper.data.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('Input');
        expect(inputNames).toContain('Attachment');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        GenAILLM({ model: 'gpt-4', prompt: 'Hi' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// HuggingFace
// ---------------------------------------------------------------------------
describe('HuggingFace', () => {
    it('returns object with out and in', () => {
        const comp = HuggingFace({
            accessToken: 'tok', modelName: 'bert', modelTask: 'classify',
            name: 'hf', displayName: 'HF', desc: 'desc',
        });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "HuggingFace"', () => {
        const comp = HuggingFace({
            accessToken: 'tok', modelName: 'bert', modelTask: 'classify',
            name: 'hf', displayName: 'HF', desc: 'desc',
        });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('HuggingFace');
    });

    it('passes settings through', () => {
        const comp = HuggingFace({
            accessToken: 'mytoken', modelName: 'gpt2', modelTask: 'generation',
            name: 'hf', displayName: 'HF Test', desc: 'Test desc',
        });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.accessToken).toBe('mytoken');
        expect(wrapper.data.data.modelName).toBe('gpt2');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        HuggingFace({
            accessToken: 'tok', modelName: 'bert', modelTask: 'classify',
            name: 'hf', displayName: 'HF', desc: 'desc',
        }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// ImageGenerator
// ---------------------------------------------------------------------------
describe('ImageGenerator', () => {
    it('returns object with out and in', () => {
        const comp = ImageGenerator({ model: 'dall-e-3' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "ImageGenerator"', () => {
        const comp = ImageGenerator({ model: 'dall-e-3' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('ImageGenerator');
    });

    it('passes settings through', () => {
        const comp = ImageGenerator({ model: 'dall-e-3', prompt: 'A cat', quality: 'hd' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.model).toBe('dall-e-3');
        expect(wrapper.data.data.prompt).toBe('A cat');
        expect(wrapper.data.data.quality).toBe('hd');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        ImageGenerator({ model: 'dall-e-3' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// MCPClient
// ---------------------------------------------------------------------------
describe('MCPClient', () => {
    it('returns object with out and in', () => {
        const comp = MCPClient({ mcpUrl: 'http://mcp.io', name: 'mcp1' });
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "MCPClient"', () => {
        const comp = MCPClient({ mcpUrl: 'http://mcp.io', name: 'mcp1' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('MCPClient');
    });

    it('passes settings through', () => {
        const comp = MCPClient({ mcpUrl: 'http://mcp.io', name: 'test', prompt: 'Do something' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.mcpUrl).toBe('http://mcp.io');
        expect(wrapper.data.data.prompt).toBe('Do something');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        MCPClient({ mcpUrl: 'http://mcp.io', name: 'mcp1' }, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// ScrapflyWebScrape
// ---------------------------------------------------------------------------
describe('ScrapflyWebScrape', () => {
    it('returns object with out and in', () => {
        const comp = ScrapflyWebScrape({});
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "ScrapflyWebScrape"', () => {
        const comp = ScrapflyWebScrape({});
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('ScrapflyWebScrape');
    });

    it('passes settings through', () => {
        const comp = ScrapflyWebScrape({ antiScrapingProtection: true, format: 'markdown' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.antiScrapingProtection).toBe(true);
        expect(wrapper.data.data.format).toBe('markdown');
    });

    it('has Results and FailedURLs outputs', () => {
        const comp = ScrapflyWebScrape({});
        expect(comp.out).toHaveProperty('Results');
        expect(comp.out).toHaveProperty('FailedURLs');
        expect((comp.out.Results as any).__path__).toBe('Results');
        expect((comp.out.FailedURLs as any).__path__).toBe('FailedURLs');
    });

    it('has URLs in its declared inputs', () => {
        const comp = ScrapflyWebScrape({});
        const wrapper = (comp.out as any).__root__;
        const inputNames = wrapper.data.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('URLs');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        ScrapflyWebScrape({}, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// ServerlessCode
// ---------------------------------------------------------------------------
describe('ServerlessCode', () => {
    it('returns object with out and in', () => {
        const comp = ServerlessCode({});
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "ServerlessCode"', () => {
        const comp = ServerlessCode({});
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('ServerlessCode');
    });

    it('passes settings through', () => {
        const comp = ServerlessCode({ code: 'exports.handler = () => {}', region: 'us-east-1' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.code).toBe('exports.handler = () => {}');
        expect(wrapper.data.data.region).toBe('us-east-1');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        ServerlessCode({}, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// TavilyWebSearch
// ---------------------------------------------------------------------------
describe('TavilyWebSearch', () => {
    it('returns object with out and in', () => {
        const comp = TavilyWebSearch({});
        expect(comp).toHaveProperty('out');
        expect(comp).toHaveProperty('in');
    });

    it('creates ComponentWrapper with name "TavilyWebSearch"', () => {
        const comp = TavilyWebSearch({});
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.name).toBe('TavilyWebSearch');
    });

    it('passes settings through', () => {
        const comp = TavilyWebSearch({ includeImages: true, sourcesLimit: 5, searchTopic: 'news' });
        const wrapper = (comp.out as any).__root__;
        expect(wrapper.data.data.includeImages).toBe(true);
        expect(wrapper.data.data.sourcesLimit).toBe(5);
        expect(wrapper.data.data.searchTopic).toBe('news');
    });

    it('has Results output', () => {
        const comp = TavilyWebSearch({});
        expect(comp.out).toHaveProperty('Results');
        expect((comp.out.Results as any).__path__).toBe('Results');
    });

    it('has SearchQuery in its declared inputs', () => {
        const comp = TavilyWebSearch({});
        const wrapper = (comp.out as any).__root__;
        const inputNames = wrapper.data.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('SearchQuery');
    });

    it('pushes to agent when provided', () => {
        const agent = createMockAgent();
        TavilyWebSearch({}, agent);
        expect(agent.structure.components).toHaveLength(1);
        expect(agent.sync).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all components share the same pattern
// ---------------------------------------------------------------------------
describe('All generated components - common patterns', () => {
    const factories = [
        { name: 'APICall', fn: APICall, args: { method: 'GET', url: 'http://x' } },
        { name: 'APIOutput', fn: APIOutput, args: { format: 'full' } },
        { name: 'Await', fn: Await, args: {} },
        { name: 'Classifier', fn: Classifier, args: { model: 'gpt-4' } },
        { name: 'ECMASandbox', fn: ECMASandbox, args: {} },
        { name: 'FTimestamp', fn: FTimestamp, args: {} },
        { name: 'GenAILLM', fn: GenAILLM, args: { model: 'gpt-4', prompt: 'hi' } },
        { name: 'HuggingFace', fn: HuggingFace, args: { accessToken: 't', modelName: 'm', modelTask: 't', name: 'n', displayName: 'd', desc: 'd' } },
        { name: 'ImageGenerator', fn: ImageGenerator, args: { model: 'dall-e-3' } },
        { name: 'MCPClient', fn: MCPClient, args: { mcpUrl: 'http://x', name: 'n' } },
        { name: 'ScrapflyWebScrape', fn: ScrapflyWebScrape, args: {} },
        { name: 'ServerlessCode', fn: ServerlessCode, args: {} },
        { name: 'TavilyWebSearch', fn: TavilyWebSearch, args: {} },
    ] as const;

    factories.forEach(({ name, fn, args }) => {
        it(`${name}: factory returns { out, in }`, () => {
            const comp = (fn as any)(args);
            expect(comp).toHaveProperty('out');
            expect(comp).toHaveProperty('in');
            expect(typeof comp.in).toBe('function');
        });

        it(`${name}: ComponentWrapper ID starts with "C"`, () => {
            const comp = (fn as any)(args);
            const wrapper = (comp.out as any).__root__;
            expect(wrapper.id).toMatch(/^C/);
        });

        it(`${name}: out.__root__ is the ComponentWrapper`, () => {
            const comp = (fn as any)(args);
            const wrapper = (comp.out as any).__root__;
            expect(wrapper).toBeDefined();
            expect(wrapper.data).toBeDefined();
            expect(wrapper.data.name).toBe(name);
        });

        it(`${name}: out.__path__ is empty string`, () => {
            const comp = (fn as any)(args);
            expect((comp.out as any).__path__).toBe('');
        });
    });
});
