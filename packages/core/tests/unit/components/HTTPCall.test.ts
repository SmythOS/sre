import http from 'http';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { HTTPCall } from '../../../src/Components/HTTPCall.class';

const agent: any = { id: 'agent', teamId: 'team', agentRuntime: { debug: false }, isKilled: () => false };

let server: http.Server;
let port: number;

beforeAll(() => {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
                const response = {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: body ? JSON.parse(body) : undefined,
                };
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(response));
            });
        }).listen(0, () => {
            port = (server.address() as any).port;
            resolve();
        });
    });
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('HTTPCall Component', () => {
    it('performs GET request with query', async () => {
        const httpCall = new HTTPCall();
        const config = { data: { method: 'GET', url: `http://localhost:${port}/test`, query: { foo: 'bar' }, headers: { 'X-Test': '1' } } };
        const result = await httpCall.process({}, config, agent);
        expect(result.Status).toBe(200);
        expect(result.Response.method).toBe('GET');
        expect(result.Response.url).toContain('foo=bar');
        expect(result.Response.headers['x-test']).toBe('1');
    });

    it('performs POST request with body', async () => {
        const httpCall = new HTTPCall();
        const config = { data: { method: 'POST', url: `http://localhost:${port}/post`, body: { hello: 'world' } } };
        const result = await httpCall.process({}, config, agent);
        expect(result.Status).toBe(200);
        expect(result.Response.method).toBe('POST');
        expect(result.Response.body).toEqual({ hello: 'world' });
    });
});
