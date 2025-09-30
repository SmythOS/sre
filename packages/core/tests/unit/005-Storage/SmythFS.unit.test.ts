import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import http, { Server } from 'http';
import axios from 'axios';
import { setupSRE } from '../../utils/sre';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';

const PORT = 8084;
const BASE_URL = `http://localhost:${PORT}`;

const app = express();
const { SREInstance } = setupSRE({
    Router: {
        Connector: 'ExpressRouter',
        Settings: { router: app, baseUrl: BASE_URL },
    },
});

const server = http.createServer(app);

if (!SREInstance.ready()) {
    process.exit(1);
}

describe('SmythFS - unit (router + storage integration)', () => {
    beforeAll(async () => {
        await new Promise((r) => server.listen(PORT, r as any));
    });

    afterAll(async () => {
        await new Promise((r) => server.close(r as any));
    });

    it('writes, reads, checks existence, and deletes via smythfs URI', async () => {
        const smythFS = SmythFS.Instance;
        const candidate = AccessCandidate.agent('agent-abc');
        const uri = `smythfs://default.team/agents/${candidate.id}/unit-file.txt`;

        await smythFS.write(uri, 'Hello SmythFS!', candidate);
        const exists = await smythFS.exists(uri, candidate);
        expect(exists).toBe(true);

        const data = await smythFS.read(uri, candidate);
        expect(data.toString()).toBe('Hello SmythFS!');

        await smythFS.delete(uri, candidate);
        const existsAfter = await smythFS.exists(uri, candidate);
        expect(existsAfter).toBe(false);
    });

    it('genTempUrl returns hashed route and serves content; destroyTempUrl invalidates', async () => {
        const smythFS = SmythFS.Instance;
        const candidate = AccessCandidate.team('Team2');
        const uri = `smythfs://${candidate.id}.team/temp/test.txt`;

        await smythFS.write(uri, 'temp content', candidate);
        const tempUrl = await smythFS.genTempUrl(uri, candidate, 60);
        expect(tempUrl.startsWith(`${BASE_URL}/_temp/`)).toBe(true);
        // ensure hash segment exists
        const parts = tempUrl.split('/_temp/')[1].split('/');
        expect(parts[0].length).toBeGreaterThan(0);

        const res = await axios.get(tempUrl, { responseType: 'text' });
        expect(res.status).toBe(200);
        expect(res.data).toBe('temp content');

        await smythFS.destroyTempUrl(tempUrl, { delResource: true });
        const after = await axios.get(tempUrl).catch((e) => e);
        expect(after?.response?.status).toBe(404);
        const exists = await smythFS.exists(uri, candidate).catch(() => false);
        expect(exists).toBe(false);
    });

    it('genResourceUrl requires agent role and includes hash path; serves data', async () => {
        const smythFS = SmythFS.Instance;
        const agent = AccessCandidate.agent('agent-hash');
        const uri = `smythfs://default.team/components_data/hash-file.txt`;

        await smythFS.write(uri, 'resource content', agent, { ContentType: 'text/plain' });

        const url = await smythFS.genResourceUrl(uri, agent);
        // url domain may be stage domain if configured, normalize for testing
        const baseUrl = ConnectorService.getRouterConnector().baseUrl;
        const testUrl = url.replace(/^https?:\/\/[^/]+/, baseUrl);

        expect(testUrl.includes('/storage/')).toBe(true);
        // ensure hash segment exists
        const seg = testUrl.split('/storage/')[1].split('/')[0];
        expect(seg.length).toBeGreaterThan(0);

        const res = await axios.get(testUrl, { responseType: 'text' });
        expect(res.status).toBe(200);
        expect(res.data).toBe('resource content');
    });
});
