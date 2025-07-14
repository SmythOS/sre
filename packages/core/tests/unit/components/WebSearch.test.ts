import http from 'http';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { WebSearch } from '../../../src/Components/WebSearch.class';

const agent: any = { id: 'agent', teamId: 'team', agentRuntime: { debug: false }, isKilled: () => false };

let server: http.Server;
let port: number;

beforeAll(() => {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            const url = new URL(req.url ?? '', `http://${req.headers.host}`);
            const response = {
                query: url.searchParams.get('q'),
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
        }).listen(0, () => {
            port = (server.address() as any).port;
            resolve();
        });
    });
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('WebSearch Component', () => {
    it('returns results for search query', async () => {
        const webSearch = new WebSearch();
        const config = { data: { url: `http://localhost:${port}/search` } };
        const result = await webSearch.process({ SearchQuery: 'hello' }, config, agent);
        expect(result.Status).toBe(200);
        expect(result.Results.query).toBe('hello');
    });
});
