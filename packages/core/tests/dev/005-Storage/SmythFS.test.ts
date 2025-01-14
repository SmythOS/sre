import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import express from 'express';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';

import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import http, { Server } from 'http';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import axios from 'axios';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
const PORT = 8083;
const BASE_URL = `http://localhost:${PORT}`;

const app = express();

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'DummyAccount',
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
    AgentData: {
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: process.env.AGENT_DOMAIN || '',
            agentProdDomain: process.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
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
    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
        },
    },
});

//  make router listen on port 3000
const server = http.createServer(app);

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
            const uri = 'smythfs://default.team/myTestAgent/myTestFile.txt';

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
            const uri = 'smythfs://default.team/myTestAgent/myTestFile.txt';

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
            const uri = 'smythfs://default.team/myTestAgent/myTestFile.txt';

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
            const uri = 'smythfs://default.team/myTestAgent/myTestFile.txt';

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
            console.log('tempUrl', tempUrl);

            expect(tempUrl).toBeDefined();

            const response = await axios.get(tempUrl, {
                responseType: 'arraybuffer',
            });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe(contentType);

            expect(Buffer.from(response.data).equals(Buffer.from(_preparedContent))).toBeTruthy();

            // delete the file
            // await smythFS.destroyTempUrl(tempUrl, { delResource: true }).catch((e) => {}); // destroyTempUrl wil be tested in separate test
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
            const responseErr = await axios.get(tempUrl).catch((e) => e);
            expect(responseErr?.response?.status).toBe(404);

            // check if the file still exists
            const exists = await smythFS.exists(uri, candidate);
            expect(exists).toBeFalsy();
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Expire temp url after TTL', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const candidate: IAccessCandidate = AccessCandidate.team('team-123456');
            const uri = `smythfs://${candidate.id}.team/myTestAgent/myTestFile_unqiue`;

            // write the file
            await smythFS.write(uri, 'Hello World!', candidate);

            // set the ttl
            const tempUrl = await smythFS.genTempUrl(uri, candidate, 2); // 1 second ttl

            // wait for the ttl to expire
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const responseErr = await axios.get(tempUrl).catch((e) => e);
            expect(responseErr?.response?.status).toBe(404);
        } catch (e) {
            error = e;
        }

        console.log('error', error);
        expect(error).toBeUndefined();
    });

    it.each([
        { contentType: 'text/plain', content: 'Hello World!' },
        { contentType: 'image/png', content: 'avatar.png' },
    ])('Generate resource url to serve $contentType content', async ({ contentType, content }) => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };

            // const uri = `smythfs://default.team/myTestAgent/resourceFile`;
            const uri = `smythfs://default.team/components_data/resourceFile`;

            // Write the file
            let _preparedContent;
            if (contentType === 'text/plain') {
                _preparedContent = content;
            } else if (contentType === 'image/png') {
                const image = await fs.promises.readFile(path.join(__dirname, `../../data/${content}`));
                _preparedContent = image;
            }

            await smythFS.write(uri, _preparedContent, candidate, { ContentType: contentType });

            const resourceUrl = await smythFS.genResourceUrl(uri, candidate);
            const agentDomain = `https://${ConnectorService.getAgentDataConnector().getAgentConfig(candidate.id).agentStageDomain}`;

            expect(resourceUrl).toBeDefined();
            console.log('agent domain', agentDomain);
            expect(resourceUrl.startsWith(agentDomain)).toBeTruthy();
            expect(resourceUrl.endsWith(mime.getExtension(contentType))).toBeTruthy();

            // Test serving the resource
            const testUrl = resourceUrl.replace(agentDomain, BASE_URL);
            // for testing, we will use the the BaseUrl to fetch the resource
            const response = await axios.get(testUrl, {
                responseType: 'arraybuffer',
            });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe(contentType);
            expect(Buffer.from(response.data).equals(Buffer.from(_preparedContent))).toBeTruthy();
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Should not allow non-agent users to generate resource urls', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const candidate: IAccessCandidate = AccessCandidate.team('team-123456');
            const uri = `smythfs://${candidate.id}.team/myTestAgent/resourceFile`;

            await smythFS.write(uri, 'Hello World!', candidate);
            await smythFS.genResourceUrl(uri, candidate);
        } catch (e) {
            error = e;
        }

        expect(error?.message).toBe('Only agents can generate resource urls');
    });

    // it('Delete content after the resource url is destroyed', async () => {
    //     const smythFS = SmythFS.Instance;
    //     let error;
    //     try {
    //         const candidate: IAccessCandidate = {
    //             role: TAccessRole.Agent,
    //             id: 'agent-123456',
    //         };
    //         const uri = `smythfs://default.team/myTestAgent/resourceToDelete`;

    //         // Write the file
    //         await smythFS.write(uri, 'Hello World!', candidate);

    //         // Generate resource url
    //         const resourceUrl = await smythFS.genResourceUrl(uri, candidate);

    //         // Delete the resource
    //         await smythFS.destroyResourceUrl(resourceUrl, { delResource: true });

    //         // Try to reach the destroyed content
    //         const responseErr = await axios.get(resourceUrl).catch((e) => e);
    //         expect(responseErr?.response?.status).toBe(404);

    //         // Check if the file still exists
    //         const exists = await smythFS.exists(uri, candidate);
    //         expect(exists).toBeFalsy();
    //     } catch (e) {
    //         error = e;
    //     }

    //     expect(error).toBeUndefined();
    // });

    it('Should handle invalid resource urls gracefully', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            // Try to access an invalid resource URL
            const invalidUrl = `${BASE_URL}/storage/invalid-uuid`;
            const responseErr = await axios.get(invalidUrl).catch((e) => e);
            expect(responseErr?.response?.status).toBe(404);
            expect(responseErr?.response?.data).toBe('Invalid Resource URL');
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    //TODO: test auto ContentTypes
});
