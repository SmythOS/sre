import { describe, expect, it, vi, beforeEach } from 'vitest';

import Agent from '@sre/AgentManager/Agent.class';
import { config, SmythRuntime } from '@sre/index';
import APICall from '@sre/Components/APICall/APICall.class';

const sre = SmythRuntime.Instance.init({
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    ManagedVault: {
        Connector: 'SmythManagedVault',
        Id: 'oauth',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            vaultName: 'oauth',
        },
    },
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
        id: 'cm186sv0a0jrecgim4ysl6vtj',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
const agent = new Agent();
const apiCall = new APICall();

describe('APICall Component - HTTP Methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    methods.forEach((method) => {
        it(`should handle ${method} method`, async () => {
            const path = ['HEAD', 'OPTIONS'].includes(method) ? 'get' : method.toLowerCase();
            const url = `https://httpbin.org/${path}`;

            const config = {
                data: {
                    method,
                    url,
                    headers: '',
                    contentType: 'none',
                    oauthService: 'None',
                    body: '',
                },
                outputs: [{ name: 'Response', index: 0, default: true }],
            };
            const output = await apiCall.process({}, config, agent);

            expect(output.Status).toEqual(200);
            expect(output.RequestConfig.method).toEqual(method);
            expect(output.RequestConfig.url).toEqual(url);
        });
    });
});

describe('APICall Component - Headers', () => {
    it('should handle default headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: '{"User-Agent": "APICall-Test", "Accept": "application/json"}',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['User-Agent']).toEqual('APICall-Test');
        expect(response.headers['Accept']).toEqual('application/json');
    });

    it('should handle custom headers', async () => {
        const authToken = 'Bearer token';
        const contentType = 'application/json';

        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: `{"Authorization": "${authToken}", "Content-Type": "${contentType}"}`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Authorization']).toEqual(authToken);
        expect(response.headers['Content-Type']).toEqual(contentType);
    });

    it('should override contentType header', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: '{"Content-Type": "application/xml"}',
                contentType: 'application/json',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(reqConfig.headers['content-type']).toEqual('application/xml');
        expect(response.headers['Content-Type']).toEqual('application/xml');
    });

    it('should resolve input template variables', async () => {
        const token = 'sdl7k8lsd93ko4iu39';
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: '{"Authorization": "Bearer {{token}}"}',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({ token }, config, agent);
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(reqConfig.headers['authorization']).toEqual(`Bearer ${token}`);
        expect(response.headers['Authorization']).toEqual(`Bearer ${token}`);
    });

    it('should resolve component annotation', async () => {
        const token = 'sdl7k8lsd93ko4iu39';
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: `{"Authorization": "Bearer {{VARVAULTINPUT:Authentication Key:[""]}}"}`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': token,
                },
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
            template: {
                settings: {
                    'VARVAULTINPUT-LTH3E8AB028': {
                        id: 'VARVAULTINPUT-LTH3E8AB028',
                        type: 'INPUT',
                        label: 'Authentication Key',
                        value: '',
                        options: [''],
                        attributes: {
                            'data-template-vars': 'true',
                            'data-vault': 'APICall,ALL',
                        },
                        _templateEntry: true,
                    },
                },
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(reqConfig.headers['authorization']).toEqual(`Bearer ${token}`);
        expect(response.headers['Authorization']).toEqual(`Bearer ${token}`);
    });

    it('should resolve vault key', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: '{"Authorization": "Bearer {{KEY(SRE TEST KEY)}}',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };

        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        const savedToken = 'sdl7k8lsd93ko4iu39';
        expect(reqConfig.headers['authorization']).toEqual(`Bearer ${savedToken}`);
        expect(response.headers['Authorization']).toEqual(`Bearer ${savedToken}`);
    });
});

describe('APICall Component - URL Formats', () => {
    it('should handle URL with query parameters', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get?a=hello%20world&b=robot',
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });

    it('should handle URL with array query parameters', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get?ids[]=1&ids[]=2&ids[]=3',
                headers: '',
                contentType: 'none',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });

    it('should handle URL with object query parameters', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get?filter[name]=John&filter[age]=30',
                headers: '',
                contentType: 'none',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });
});

describe('APICall Component - Content Types', () => {
    const contentTypes = ['none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain'];
    contentTypes.forEach((contentType) => {
        it(`should handle ${contentType} content type`, async () => {
            const config = {
                data: {
                    method: 'POST',
                    url: 'https://httpbin.org/post',
                    headers: '',
                    contentType,
                    body: contentType === 'application/json' ? '{"key": "value"}' : 'test body',
                },
                outputs: [{ name: 'Response', index: 0, default: true }],
            };
            const output = await apiCall.process({}, config, agent);
            expect(output).toBeDefined();
        });
    });
});

describe('APICall Component - OAuth', () => {
    it('should handle OAuth1 authentication', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get',
                headers: '',
                contentType: 'none',
                body: '',
                oauthService: 'OAuth1',
                consumerKey: 'consumerKey',
                consumerSecret: 'consumerSecret',
                token: 'token',
                tokenSecret: 'tokenSecret',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });

    it('should handle OAuth2 authentication', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get',
                headers: '',
                contentType: 'none',
                body: '',
                oauthService: 'OAuth2',
                clientID: 'clientID',
                clientSecret: 'clientSecret',
                tokenURL: 'https://oauth2.example.com/token',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });
});

describe('APICall Component - Proxy', () => {
    it('should handle proxy settings', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/get',
                headers: '',
                contentType: 'none',
                body: '',
                proxy: 'http://proxy.example.com:8080',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output).toBeDefined();
    });
});

describe('APICall Component - Error Handling', () => {
    it('should handle network errors', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://invalid.url',
                headers: '',
                contentType: 'none',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output._error).toBeDefined();
    });

    it('should handle invalid URL errors', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'invalid-url',
                headers: '',
                contentType: 'none',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        expect(output._error).toBeDefined();
    });
});

describe('APICall Component', () => {
    it('Parses url passed as input variable', async () => {
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

    it('Handles OAuth tokens', async () => {
        // @ts-ignore
        const agent = new Agent();
        agent.id = 'cm186sv0a0jrecgim4ysl6vtj';
        agent.teamId = '9';
        const apiCall = new APICall();

        const inputs = {};
        const output = await apiCall.process(
            inputs,
            {
                id: 'CM1AJB22RBOI', //required to retrieve oauth tokens
                data: {
                    method: 'POST',
                    url: 'https://www.example.com/test',
                    headers: '{  "Authorization": "Bearer sqlkjsdqlmsdqkjlsdkjsdqlkjsdqlkjsqdlksdj"}',
                    contentType: 'none',
                    body: '',
                    proxy: '',
                    oauthService: 'Google',
                    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
                    clientID: '{{KEY(Google_Gmail_Client_ID)}}',
                    clientSecret: '{{KEY(Google_Gmail_ClientSecret)}}',
                    scope: 'https://www.googleapis.com/auth/gmail.readonly',
                    tokenURL: 'https://oauth2.googleapis.com/token',
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
                ],
            },
            agent
        );

        expect(output).toBeDefined();
    });

    it('handle binary data in the body', async () => {
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
