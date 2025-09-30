import express, { Request, Response } from 'express';
import http from 'http';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

import { Agent } from '@sre/AgentManager/Agent.class';
import { APICall } from '@sre/Components/APICall/APICall.class';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { testData } from '../../utils/test-data-manager';
import { AccessCandidate, SmythFS } from 'index';

// Local httpbin-like simulator for deterministic unit tests
const app = express();
let server: http.Server;
let BASE_LOCAL = '';

// Keep the same BASE_URL for SmythFS temp URL generation (not actually served)
const BASE_URL = `http://agents-server.smyth.stage`;

// Wire Router + Vault via SRE setup
setupSRE({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: testData.getDataPath('vault.fake.json'),
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

// Helpers
function canonicalizeHeaders(raw: Record<string, any>) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw || {})) {
        if (!k) continue;
        const canonical = k
            .split('-')
            .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
            .join('-');
        out[canonical] = Array.isArray(v) ? v.join(', ') : v;
    }
    return out;
}

function getFullUrl(req: Request) {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}${req.originalUrl}`;
}

function getArgsFromQuery(req: Request) {
    const url = new URL(getFullUrl(req));
    const params = new URLSearchParams(url.search);
    const args: Record<string, any> = {};
    for (const [key, value] of params.entries()) {
        if (args[key] === undefined) args[key] = value;
        else if (Array.isArray(args[key])) (args[key] as any[]).push(value);
        else args[key] = [args[key], value];
    }
    return { args, url: `${url.origin}${url.pathname}${url.search}` };
}

function collectRawBody(req: Request): Promise<Buffer> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

function bufferIndexOf(buffer: Buffer, sub: Buffer, start: number = 0): number {
    return buffer.indexOf(sub, start);
}

function trimCrlf(buf: Buffer): Buffer {
    // Trim trailing CRLF
    let end = buf.length;
    if (end >= 2 && buf[end - 2] === 13 && buf[end - 1] === 10) end -= 2; // \r\n
    return buf.subarray(0, end);
}

function parseMultipart(buffer: Buffer, contentType: string): { fields: Record<string, string>; files: Record<string, string> } {
    const fields: Record<string, string> = {};
    const files: Record<string, string> = {};
    const match = /boundary=(.*)$/i.exec(contentType || '');
    if (!match) return { fields, files };
    const boundary = `--${match[1]}`;
    const boundaryBuf = Buffer.from(boundary);
    const endBoundaryBuf = Buffer.from(`${boundary}--`);

    let pos = 0;
    // Skip preamble until first boundary
    let idx = bufferIndexOf(buffer, boundaryBuf, pos);
    if (idx < 0) return { fields, files };
    pos = idx + boundaryBuf.length + 2; // skip boundary + CRLF

    while (pos < buffer.length) {
        // Check end boundary
        if (bufferIndexOf(buffer, endBoundaryBuf, pos) === pos - boundaryBuf.length - 2) break;

        // Find next boundary
        const nextBoundary = bufferIndexOf(buffer, boundaryBuf, pos);
        const part = nextBoundary >= 0 ? buffer.subarray(pos, nextBoundary - 2) : buffer.subarray(pos); // exclude CRLF before boundary

        // Split headers/body
        const sep = Buffer.from('\r\n\r\n');
        const sepIdx = bufferIndexOf(part, sep, 0);
        if (sepIdx >= 0) {
            const headersBuf = part.subarray(0, sepIdx);
            const bodyBuf = trimCrlf(part.subarray(sepIdx + sep.length));
            const headersStr = headersBuf.toString('utf8');
            const nameMatch = /name="([^"]+)"/i.exec(headersStr);
            const filenameMatch = /filename="([^"]*)"/i.exec(headersStr);
            const ctMatch = /content-type:\s*([^\r\n]+)/i.exec(headersStr);
            const name = nameMatch ? nameMatch[1] : '';
            const ctype = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

            if (filenameMatch || ctMatch) {
                const dataUrl = `data:${ctype};base64,${bodyBuf.toString('base64')}`;
                if (name) files[name] = dataUrl;
            } else {
                if (name) fields[name] = bodyBuf.toString('utf8');
            }
        }

        if (nextBoundary < 0) break;
        pos = nextBoundary + boundaryBuf.length + 2; // move past CRLF
        // Check end boundary
        if (bufferIndexOf(buffer, endBoundaryBuf, nextBoundary) === nextBoundary) break;
    }

    return { fields, files };
}

// Routes
app.all('/get', (req: Request, res: Response) => {
    const { args, url } = getArgsFromQuery(req);
    res.status(200).json({
        args,
        url,
        headers: canonicalizeHeaders(req.headers as any),
    });
});

app.options('/get', (req: Request, res: Response) => {
    const { args, url } = getArgsFromQuery(req);
    res.status(200).json({
        args,
        url,
        headers: canonicalizeHeaders(req.headers as any),
    });
});

app.get('/headers', (req: Request, res: Response) => {
    res.status(200).json({ headers: canonicalizeHeaders(req.headers as any) });
});

app.get('/basic-auth/:user/:pass', (req: Request, res: Response) => {
    const auth = req.headers['authorization'] || '';
    const expected = Buffer.from(`${req.params.user}:${req.params.pass}`).toString('base64');
    const ok = typeof auth === 'string' && auth.startsWith('Basic ') && auth.slice(6) === expected;
    if (!ok) return res.status(401).json({ authenticated: false });
    res.status(200).json({ authenticated: true, user: req.params.user });
});

app.post('/post', async (req: Request, res: Response) => {
    const raw = await collectRawBody(req);
    const ct = (req.headers['content-type'] as string) || '';
    const bodyStr = raw.toString('utf8');
    const out: any = { headers: canonicalizeHeaders(req.headers as any) };

    if (ct.includes('application/json')) {
        try {
            out.json = JSON.parse(bodyStr || '{}');
        } catch {
            out.json = {};
        }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(bodyStr);
        const form: Record<string, string> = {};
        for (const [k, v] of (params as any).entries()) form[k] = v;
        out.form = form;
        // Mirror httpbin behavior: also include raw body string in `data`
        out.data = bodyStr;
    } else if (ct.includes('multipart/form-data')) {
        const { fields, files } = parseMultipart(raw, ct);
        if (Object.keys(fields).length) out.form = fields;
        if (Object.keys(files).length) out.files = files;
    } else {
        // Treat as binary or text
        out.data = `data:application/octet-stream;base64,${raw.toString('base64')}`;
    }

    res.status(200).json(out);
});

beforeAll(async () => {
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    BASE_LOCAL = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(() => resolve(true)));
});

// Reuse agent + component from integration-like tests
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true },
        teamId: 'Team2',
        isKilled: () => false,
        modelsProvider: ConnectorService.getModelsProviderConnector(),
    }));
    return { Agent: MockedAgent };
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
const agent = new Agent();
const apiCall = new APICall();

const VAULT_KEY_TEMPLATE_VAR = '{{KEY(SRE TEST KEY)}}';
const DUMMY_KEY = 'sdl7k8lsd93ko4iu39';

// Local image fixture
const IMAGE_PATH = testData.getDataPath('smythos.png');
const IMAGE_MIME = 'image/png';

describe('APICall Component (Local httpbin simulator) - HTTP Methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    methods.forEach((method) => {
        it(`handle ${method} method`, async () => {
            const path = ['HEAD', 'OPTIONS'].includes(method) ? 'get' : method.toLowerCase();
            const url = `${BASE_LOCAL}/${path}`;

            const config = {
                data: {
                    method,
                    url,
                    headers: '',
                    contentType: 'none',
                    oauthService: 'None',
                    body: '',
                },
            };
            const output = await apiCall.process({}, config, agent);
            const headers = output.Headers;
            expect(headers).toBeInstanceOf(Object);
        });
    });
});

describe('APICall Component (Local) - Headers', () => {
    it('handle default headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: `${BASE_LOCAL}/headers`,
                headers: '{"User-Agent": "APICall-Test", "Accept": "application/json"}',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['User-Agent']).toEqual('APICall-Test');
        expect(response.headers['Accept']).toEqual('application/json');
    });

    it('handle custom headers', async () => {
        const authToken = 'Bearer token';
        const contentType = 'application/json';
        const config = {
            data: {
                method: 'GET',
                url: `${BASE_LOCAL}/headers`,
                headers: `{"Authorization": "${authToken}", "Content-Type": "${contentType}"}`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toEqual(contentType);
        expect(response.headers['Authorization']).toEqual(authToken);
    });

    it('should override contentType header', async () => {
        const config = {
            data: {
                method: 'GET',
                url: `${BASE_LOCAL}/headers`,
                headers: '{"Content-Type": "application/xml"}',
                contentType: 'application/json',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toEqual('application/xml');
    });

    it('resolve input template variable in headers', async () => {
        const userName = 'John Doe';
        const config = {
            data: {
                method: 'GET',
                url: `${BASE_LOCAL}/headers`,
                headers: `{"Authorization": "Bearer {{key}}", X-User-Name: "{{userName}}"}`,
                contentType: 'none',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({ key: DUMMY_KEY, userName }, config, agent);
        const response = output.Response;
        expect(response.headers['Authorization']).toEqual(`Bearer ${DUMMY_KEY}`);
        expect(response.headers['X-User-Name']).toEqual(userName);
    });

    it('resolve vault key in headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: `${BASE_LOCAL}/headers`,
                headers: `{"Authorization": "Bearer ${VAULT_KEY_TEMPLATE_VAR}`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Authorization']).toEqual(`Bearer ${DUMMY_KEY}`);
    });
});

describe('APICall Component (Local) - URL Formats', () => {
    it('handle URL with query parameters', async () => {
        const url = `${BASE_LOCAL}/get?a=hello%20world&b=robot`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.args.a).toEqual('hello world');
        expect(response.args.b).toEqual('robot');
    });

    it('handle URL with array query parameters', async () => {
        const url = `${BASE_LOCAL}/get?ids[]=1&ids[]=2&ids[]=3`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.args['ids[]']).toEqual(['1', '2', '3']);
        expect(response.url).toEqual(url);
    });

    it('handle URL with multiple occurrences of the same parameter', async () => {
        const url = `${BASE_LOCAL}/get?color=red&color=blue&color=green`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.url).toEqual(url);
        expect(response.args.color).toEqual(['red', 'blue', 'green']);
    });

    it('handle URL with fragment identifier', async () => {
        const urlWithoutFragment = `${BASE_LOCAL}/get?param=value`;
        const url = `${urlWithoutFragment}#section1`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.url).toEqual(urlWithoutFragment);
        expect(response.args.param).toEqual('value');
    });

    it('handle URL with basic auth credentials', async () => {
        const url = `http://user:pass@${BASE_LOCAL.replace('http://', '')}/basic-auth/user/pass`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.authenticated).toEqual(true);
        expect(response.user).toEqual('user');
    });

    it('handle wrong URL', async () => {
        const url = `${BASE_LOCAL}/wrong-url`;
        const config = { data: { method: 'GET', url, headers: '', contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({}, config, agent);
        expect(output._error).toBeDefined();
        expect(output._error).toContain('404');
    });

    it('resolve input template variable in URL', async () => {
        const user = 'John Doe';
        const url = `${BASE_LOCAL}/get?user={{user}}`;
        const config = { data: { method: 'GET', url, contentType: 'none', oauthService: 'None', body: '' } };
        const output = await apiCall.process({ user }, config, agent);
        const response = output.Response;
        expect(response.args.user).toEqual(user);
        expect(response.url).toEqual(`${BASE_LOCAL}/get?user=${encodeURIComponent(user)}`);
    });

    it('resolve smythfs:// URI in public URL', async () => {
        await SmythFS.Instance.write('smythfs://Team2.team/agent-123456/_temp/file.txt', 'Hello, world!', AccessCandidate.agent('agent-123456'));
        const url = `${BASE_LOCAL}/get?image=smythfs://Team2.team/agent-123456/_temp/file.txt`;
        const config = { data: { method: 'GET', url, contentType: 'none', oauthService: 'None', body: '', headers: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        const regex = new RegExp(`${BASE_URL}`);
        await SmythFS.Instance.delete('smythfs://Team2.team/agent-123456/_temp/file.txt', AccessCandidate.agent('agent-123456'));
        expect(response.args.image).toMatch(regex);
    });

    it('does not resolve smythfs:// URI if it does not belong to the agent', async () => {
        await SmythFS.Instance.write('smythfs://Team2.team/agent-007/_temp/file.txt', 'Hello, world!', AccessCandidate.agent('agent-007'));
        const url = `${BASE_LOCAL}/get?image=smythfs://AnotherTeam.team/agent-007/_temp/M4I8A5XIDKJ.jpeg`;
        const config = { data: { method: 'GET', url, contentType: 'none', oauthService: 'None', body: '', headers: '' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        await SmythFS.Instance.delete('smythfs://Team2.team/agent-007/_temp/file.txt', AccessCandidate.agent('agent-007'));
        expect(response).toBeUndefined();
        expect(output).toHaveProperty('_error');
        expect(output._error).toContain('Access Denied');
    });
});

describe('APICall Component (Local) - Content Types', () => {
    const contentTypes = ['none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain'];
    contentTypes.forEach((contentType) => {
        it(`handle ${contentType} content type`, async () => {
            const config = { data: { method: 'GET', url: `${BASE_LOCAL}/get`, headers: '', contentType, oauthService: 'None' } };
            const output = await apiCall.process({}, config, agent);
            const response = output.Response;
            const expectedContentType = contentType === 'none' ? undefined : contentType;
            expect(response.headers['Content-Type']).toEqual(expectedContentType);
        });
    });
});

describe('APICall Component (Local) - Body', () => {
    it('handle application/json content type', async () => {
        const body = { name: 'John Doe', age: 30 };
        const config = {
            data: {
                method: 'POST',
                url: `${BASE_LOCAL}/post`,
                headers: '',
                contentType: 'application/json',
                body: JSON.stringify(body),
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json).toEqual(body);
    });

    it('handle application/x-www-form-urlencoded content type', async () => {
        const config = {
            data: {
                method: 'POST',
                url: `${BASE_LOCAL}/post`,
                headers: '',
                contentType: 'application/x-www-form-urlencoded',
                body: 'name=John+Doe&age=30',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
        expect(response.form).toEqual({ name: 'John Doe', age: '30' });
    });

    it('handle text/plain content type', async () => {
        const config = {
            data: { method: 'POST', url: `${BASE_LOCAL}/post`, headers: '', contentType: 'text/plain', body: 'Hello, world!', oauthService: 'None' },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toContain('text/plain');
        expect(response.data).toEqual('data:application/octet-stream;base64,SGVsbG8sIHdvcmxkIQ==');
    });

    it('handle multipart/form-data with base64 input', async () => {
        const buffer = testData.readBinaryData('smythos.png');
        const base64Url = `data:${IMAGE_MIME};base64,${buffer.toString('base64')}`;
        const config = {
            data: {
                method: 'POST',
                url: `${BASE_LOCAL}/post`,
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
            inputs: [{ name: 'image', type: 'Binary', color: '#F35063', optional: false, index: 0, default: false }],
        } as any;
        const output = await apiCall.process({ image: base64Url }, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle multipart/form-data with SmythFile object input', async () => {
        const buffer = testData.readBinaryData('smythos.png');
        const size = buffer.byteLength;
        const config = {
            data: {
                method: 'POST',
                url: `${BASE_LOCAL}/post`,
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
        } as any;
        const output = await apiCall.process(
            { image: { mimetype: IMAGE_MIME, size, url: `file://${IMAGE_PATH}`, name: 'smythos.png' } },
            config,
            agent
        );
        const response = output.Response;
        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle binary content type with base64 input', async () => {
        const buffer = testData.readBinaryData('smythos.png');
        const base64Url = `data:${IMAGE_MIME};base64,${buffer.toString('base64')}`;
        const config = {
            data: { method: 'POST', url: `${BASE_LOCAL}/post`, headers: '', contentType: 'binary', body: '{{file}}', oauthService: 'None' },
            inputs: [{ name: 'file', type: 'Binary', color: '#F35063', optional: false, index: 0, default: false }],
        } as any;
        const output = await apiCall.process({ file: base64Url }, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toMatch(IMAGE_MIME);
        expect(response.headers['Content-Length']).toEqual(buffer.byteLength.toString());
        expect(response.data).toMatch(/^data:application\/octet-stream;base64,/);
    });

    it('handle empty body', async () => {
        const config = { data: { method: 'POST', url: `${BASE_LOCAL}/post`, headers: '', contentType: 'none', body: '', oauthService: 'None' } };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Content-Type']).toEqual('application/x-www-form-urlencoded');
        expect(response.data).toEqual('');
        expect(response.headers['Content-Length']).toEqual('0');
    });
});
