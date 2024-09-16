import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { Router } from 'express';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';

import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import http from 'http';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import axios from 'axios';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const TEMP_HOST = `http://localhost:${PORT}`;

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'MyCustomAccountConnector',
        Settings: {},
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
});
const router = Router();
SREInstance.router = router;

//  make router listen on port 3000
const server = http.createServer(router);

if (!SREInstance.ready()) {
    process.exit(1);
} //force SmythRuntime to initialize

describe('Smyth FileSystem Tests', () => {
    beforeAll(async () => {
        const listen = promisify(server.listen.bind(server));
        await listen(PORT);
        console.log(`Server is running on port ${PORT}`);
    });

    afterAll(async () => {
        const close = promisify(server.close.bind(server));
        await close();
        console.log('Server has been shut down');
    });

    it('initializes SmythFS', () => {
        const smythFS = SmythFS.Instance;
        expect(smythFS).toBeDefined();
    });
    it('Writes a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam.team/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };

            await smythFS.write(uri, 'Hello World!', candidate);
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Reads a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam.team/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };
            const data = await smythFS.read(uri, candidate);

            expect(data.toString()).toEqual('Hello World!');
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does not allow Read to a different agent ', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam.team/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-000000',
            };
            const data = await smythFS.read(uri, candidate);
        } catch (e) {
            error = e;
        }

        expect(error.message).toEqual('Access Denied');
    });

    it('Deletes a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam.team/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };

            await smythFS.delete(uri, candidate);

            const exists = await smythFS.exists(uri, candidate);

            expect(exists).toBeFalsy();
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it.each([
        { contentType: 'text/plain', content: 'Hello World!' },
        { contentType: 'image/png', content: 'avatar.png' },
    ])('Generate temp url to serve $contentType content', async ({ contentType, content }) => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const candidate: IAccessCandidate = AccessCandidate.team('team-123456');

            const uri = `smythfs://${candidate.id}.team/myTestAgent/myTestFile`;

            // write the file
            let _preparedContent;
            if (contentType === 'text/plain') {
                _preparedContent = content;
            } else if (contentType === 'image/png') {
                const image = await fs.promises.readFile(path.join(__dirname, `../../data/${content}`));
                _preparedContent = image;
            }

            await smythFS.write(uri, _preparedContent, candidate);

            const tempUrl = await smythFS.genTempUrl(uri, candidate);

            expect(tempUrl).toBeDefined();

            const response = await axios.get(`${TEMP_HOST}${tempUrl}`, {
                responseType: 'arraybuffer',
            });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe(contentType);

            expect(Buffer.from(response.data).equals(Buffer.from(_preparedContent))).toBeTruthy();

            // delete the file
            await smythFS.destroyTempUrl(tempUrl, { delResource: true }).catch((e) => {}); // destroyTempUrl wil be tested in separate test
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Delete content after the temp url is destroyed', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const candidate: IAccessCandidate = AccessCandidate.team('team-123456');
            const uri = `smythfs://${candidate.id}.team/myTestAgent/myTestFile_unqiue`;

            // write the file
            await smythFS.write(uri, 'Hello World!', candidate);

            // generate temp url
            const tempUrl = await smythFS.genTempUrl(uri, candidate);

            // delete the file
            await smythFS.destroyTempUrl(tempUrl, { delResource: true });

            // try to reach the destroyed content
            const responseErr = await axios.get(`${TEMP_HOST}${tempUrl}`).catch((e) => e);
            expect(responseErr?.response?.status).toBe(404);

            // check if the file still exists
            const exists = await smythFS.exists(uri, candidate);
            expect(exists).toBeFalsy();
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Set and expire after TTL', async () => {});

    //TODO: test auto ContentTypes
});
