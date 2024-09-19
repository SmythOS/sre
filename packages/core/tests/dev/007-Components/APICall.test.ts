import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import Classifier from '@sre/Components/Classifier.class';
import APICall from '@sre/Components/APICall/APICall.class';

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
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

describe('APICall Component', () => {
    it('Parses url passed as input variable', async () => {
        // @ts-ignore
        const agent = new Agent();
        const apiCall = new APICall();

        const inputs = {
            url: "https://www.example.com/test?a=hello world&b=I'm%20a+robot&token=123456=hmac~dldmlkdmslk",
        };
        const output = await apiCall.process(
            inputs,
            {
                data: {
                    method: 'GET',
                    url: '{{url}}',
                    headers: '',
                    contentType: 'none',
                    body: '',
                    proxy: '',
                    oauthService: 'None',
                    scope: '',
                    authorizationURL: '',
                    tokenURL: '',
                    clientID: '',
                    clientSecret: '',
                    requestTokenURL: '',
                    accessTokenURL: '',
                    userAuthorizationURL: '',
                    consumerKey: '',
                    consumerSecret: '',
                    authenticate: '',
                },
                outputs: [
                    {
                        name: 'Response',
                        index: 0,
                        default: true,
                    },
                    {
                        name: 'Headers',
                        index: 1,
                        default: true,
                    },
                    {
                        name: '_error',
                        index: 2,
                        default: false,
                    },
                ],
            },
            agent
        );

        expect(output).toBeDefined();
    });

    it('handle binary data in the body', async () => {
        // @ts-ignore
        const agent = new Agent();
        const apiCall = new APICall();

        const inputs = {
            image: 'https://smythos.com/wp-content/uploads/2024/07/smythos-500px.png',
            mime: 'image/png',
        };

        const config = {
            id: 'M0ZNCIZU09I',
            name: 'APICall',
            outputs: [
                {
                    name: 'Response',
                    index: 0,
                    default: true,
                },
                {
                    name: 'Headers',
                    index: 1,
                    default: true,
                },
                {
                    name: '_error',
                    index: 2,
                    default: false,
                },
            ],
            inputs: [
                {
                    name: 'image',
                    type: 'Binary',
                    optional: false,
                    index: 0,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
                {
                    name: 'mime',
                    type: 'String',
                    optional: false,
                    index: 1,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
            ],
            data: {
                method: 'POST',
                url: 'https://www.example.com',
                headers: '{\n  "Content-Type": "{{mime}}"\n}',
                contentType: 'binary',
                body: '{{image}}',
                proxy: '',
                oauthService: 'None',
                scope: '',
                authorizationURL: '',
                tokenURL: '',
                clientID: '',
                clientSecret: '',
                requestTokenURL: '',
                accessTokenURL: '',
                userAuthorizationURL: '',
                consumerKey: '',
                consumerSecret: '',
                authenticate: '',
            },
        };

        const output = await apiCall.process(inputs, config, agent);

        expect(output).toBeDefined();
    });
    it('handles application/json body', async () => {
        // @ts-ignore
        const agent = new Agent();
        const apiCall = new APICall();

        const inputs = {
            id: '123456',
            mime: 'image/png',
        };

        const config = {
            id: 'M0ZNCIZU09I',
            name: 'APICall',
            outputs: [
                {
                    name: 'Response',
                    index: 0,
                    default: true,
                },
                {
                    name: 'Headers',
                    index: 1,
                    default: true,
                },
                {
                    name: '_error',
                    index: 2,
                    default: false,
                },
            ],
            inputs: [
                {
                    name: 'id',
                    type: 'String',
                    optional: false,
                    index: 0,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
                {
                    name: 'mime',
                    type: 'String',
                    optional: false,
                    index: 1,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
            ],
            data: {
                method: 'POST',
                url: 'https://www.example.com',
                headers: '{\n  "Content-Type": "{{mime}}", "Authorization": "Bearer 123456789654231"\n}',
                contentType: 'application/json',
                body: '{\n    "id":{{id}},\n    "name":"image",\n    \'data\':\'hello world\'\n}',
                proxy: '',
                oauthService: 'None',
                scope: '',
                authorizationURL: '',
                tokenURL: '',
                clientID: '',
                clientSecret: '',
                requestTokenURL: '',
                accessTokenURL: '',
                userAuthorizationURL: '',
                consumerKey: '',
                consumerSecret: '',
                authenticate: '',
            },
        };

        const output = await apiCall.process(inputs, config, agent);

        expect(output).toBeDefined();
    });

    it('handles array query parameters ', async () => {
        // @ts-ignore
        const agent = new Agent();
        const apiCall = new APICall();

        const inputs = {
            id: '123456',
            mime: 'image/png',
        };

        const config = {
            id: 'M0ZNCIZU09I',
            name: 'APICall',
            outputs: [
                {
                    name: 'Response',
                    index: 0,
                    default: true,
                },
                {
                    name: 'Headers',
                    index: 1,
                    default: true,
                },
                {
                    name: '_error',
                    index: 2,
                    default: false,
                },
            ],
            inputs: [
                {
                    name: 'id',
                    type: 'String',
                    optional: false,
                    index: 0,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
                {
                    name: 'mime',
                    type: 'String',
                    optional: false,
                    index: 1,
                    default: false,
                    prev: ['CM0ZNJXEQI1'],
                },
            ],
            data: {
                method: 'GET',
                url: 'https://www.example.com/',
                headers: '',
                contentType: 'application/json',
                body: '',
                proxy: '',
                oauthService: 'None',
                scope: '',
                authorizationURL: '',
                tokenURL: '',
                clientID: '',
                clientSecret: '',
                requestTokenURL: '',
                accessTokenURL: '',
                userAuthorizationURL: '',
                consumerKey: '',
                consumerSecret: '',
                authenticate: '',
            },
        };

        const output = await apiCall.process(inputs, config, agent);

        expect(output).toBeDefined();
    });
    ///
    it('Parses template variables', async () => {
        // @ts-ignore
        const agent = new Agent();
        const apiCall = new APICall();

        const output = await apiCall.process(
            {
                Input: { url: 'https://www.example.com/test?a=b' },
            },
            {
                data: {
                    method: 'GET',
                    url: 'https://api.github.com/repos/{{repo_owner}}/{{repo_name}}/issues/{{issue_number}}/labels',
                    headers:
                        '{\n  "Authorization": "Bearer {{VARVAULTINPUT:Access Token:[\\"\\"]}}",\n  "Accept": "application/vnd.github+json",\n  "X-GitHub-Api-Version": "2022-11-28"\n}',
                    contentType: 'none',
                    body: '',
                    proxy: '',
                    oauthService: 'None',
                    scope: '',
                    authorizationURL: '',
                    tokenURL: '',
                    clientID: '',
                    clientSecret: '',
                    requestTokenURL: '',
                    accessTokenURL: '',
                    userAuthorizationURL: '',
                    consumerKey: '',
                    consumerSecret: '',
                    _templateVars: {
                        'VARVAULTINPUT-LT8VG9P4U8': '{{KEY(KIWICOM_API_KEY)}}',
                    },
                },
                template: {
                    name: 'Github - Get Issue Labels',
                    componentName: 'APICall',
                    description: 'Get labels for an issue',
                    settings: {
                        'VARVAULTINPUT-LT8VG9P4U8': {
                            id: 'VARVAULTINPUT-LT8VG9P4U8',
                            type: 'INPUT',
                            label: 'Access Token',
                            value: '',
                            options: [''],
                            attributes: {
                                'data-template-vars': 'true',
                                'data-vault': 'APICall,ALL',
                            },
                            _templateEntry: true,
                        },
                    },
                    data: {
                        method: 'GET',
                        url: 'https://api.github.com/repos/{{repo_owner}}/{{repo_name}}/issues/{{issue_number}}/labels',
                        headers:
                            '{\n  "Authorization": "Bearer {{VARVAULTINPUT:Access Token:[\\"\\"]}}",\n  "Accept": "application/vnd.github+json",\n  "X-GitHub-Api-Version": "2022-11-28"\n}',
                        contentType: 'none',
                        body: '',
                        proxy: '',
                        _templateVars: {},
                    },
                    inputs: [
                        {
                            name: 'repo_owner',
                            color: '#F35063',
                            optional: false,
                            isFile: false,
                            default: false,
                        },
                        {
                            name: 'repo_name',
                            color: '#F35063',
                            optional: false,
                            isFile: false,
                            default: false,
                        },
                        {
                            name: 'issue_number',
                            color: '#F35063',
                            optional: false,
                            isFile: false,
                            default: false,
                        },
                    ],
                    outputs: [],
                    templateInfo: {
                        name: 'Github - Get Issue Labels',
                        description: 'Get labels for an issue',
                        icon: '',
                        color: '#000000',
                        docPath: '',
                        ytLink: '',
                        collection: 'custarjway0002nlnwaked4d01',
                        version: '1.0.0',
                        published: true,
                        includedSettings: [],
                        id: 'clt684fi57tsve9je5gz05zm3',
                    },
                },
                outputs: [
                    {
                        name: 'Response',
                        index: 0,
                        default: true,
                    },
                    {
                        name: 'Headers',
                        index: 1,
                        default: true,
                    },
                    {
                        name: '_error',
                        index: 2,
                        default: false,
                    },
                ],
            },
            agent
        );

        expect(output).toBeDefined();
    });
});
