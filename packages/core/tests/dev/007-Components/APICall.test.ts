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
            const status = output.Status;
            const reqConfig = output.RequestConfig;

            expect(status).toEqual(200);
            expect(reqConfig.method).toEqual(method);
            expect(reqConfig.url).toEqual(url);
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

        expect(response.headers['Authorization']).toEqual(`Bearer ${token}`);
    });

    // TODO [Forhad]: Need to make it work
    it('should resolve component template variable', async () => {
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

        expect(response.headers['Authorization']).toEqual(`Bearer ${token}`);
    });

    // TODO [Forhad]: Need to make it work
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

        const savedToken = 'sdl7k8lsd93ko4iu39';
        expect(response.headers['Authorization']).toEqual(`Bearer ${savedToken}`);
    });
});

describe('APICall Component - URL Formats', () => {
    const url = 'https://httpbin.org/get?a=hello%20world&b=robot';

    it('should handle URL with query parameters', async () => {
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(200);
        expect(response.args.a).toEqual('hello world');
        expect(response.args.b).toEqual('robot');
        expect(reqConfig.url).toEqual(url);
    });

    it('should handle URL with array query parameters', async () => {
        const url = 'https://httpbin.org/get?ids[]=1&ids[]=2&ids[]=3';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.args['ids[]']).toEqual(['1', '2', '3']);
        expect(response.url).toEqual(url);
    });

    it('should handle URL with object query parameters', async () => {
        const url = 'https://httpbin.org/get?filter[name]=John&filter[age]=30';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.url).toEqual(url);
        expect(response.args['filter[age]']).toEqual('30');
        expect(response.args['filter[name]']).toEqual('John');
    });

    it('should handle URL with multiple occurrences of the same parameter', async () => {
        const url = 'https://httpbin.org/get?color=red&color=blue&color=green';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.url).toEqual(url);
        expect(response.args.color).toEqual(['red', 'blue', 'green']);
    });

    it('should handle URL with nested object parameters', async () => {
        const url = 'https://httpbin.org/get?user[name][first]=John&user[name][last]=Doe&user[age]=30';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.url).toEqual(url);
        expect(response.args['user[name][first]']).toEqual('John');
        expect(response.args['user[name][last]']).toEqual('Doe');
        expect(response.args['user[age]']).toEqual('30');
    });

    it('should handle URL with empty parameter values', async () => {
        const url = 'https://httpbin.org/get?empty=&null=&undefined=';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.url).toEqual(url);
        expect(response.args.empty).toEqual('');
        expect(response.args.null).toEqual('');
        expect(response.args.undefined).toEqual('');
    });

    it('should handle URL with encoded spaces and plus signs', async () => {
        const url = 'https://httpbin.org/get?message=hello%20world&operation=1+1';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(200);
        expect(reqConfig.url).toEqual(url);
        expect(response.args.message).toEqual('hello world');
        expect(response.args.operation).toEqual('1 1');
    });

    //#region test cases with symbols and special characters
    // Need to make it work
    it('should handle URL with all types of raw characters and symbols', async () => {
        const allChars =
            '!@$%^*()_+-={}[]|\\:;"\'<>,.?/~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123 + 456 = 579 ©️ 🌈#&'; // we should keep # and & in the end of the string for it's special meaning in URL
        const url = `https://httpbin.org/get?all=${allChars}`;

        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        // The expected arguments and URL encoding differs between browsers and Postman, We're expecting the Postman version.
        const expectedChars =
            '!@$%^*()_ -={}[]|\\\\:;"\\\'<>,.?/~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123   456 = 579 ©️ 🌈';
        const expectedUrl =
            'https://httpbin.org/get?all=!%40$%^*()_+-={}[]|\\:%3B"\'<>,.%3F%2F~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás%3F 123 + 456 = 579 ©️ 🌈';
        expect(status).toEqual(200);
        expect(response.args.all).toEqual(expectedChars);
        expect(reqConfig.url).toEqual(expectedUrl);
        expect(response.url).toEqual(expectedUrl);
    });

    it('should handle URL with all types of encoded characters and symbols', async () => {
        const allChars =
            '!@$%^*()_+-={}[]|\\:;"\'<>,.?/~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123 + 456 = 579 ©️ 🌈#&'; // we should keep # and & in the end of the string for it's special meaning in URL
        const url = `https://httpbin.org/get?all=${encodeURIComponent(allChars)}`;

        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        const expectedChars =
            '!@$%^*()_+-={}[]|\\:;"\'<>,.?/~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123 + 456 = 579 ©️ 🌈#&';
        const expectedUrl =
            'https://httpbin.org/get?all=!%40%24%25^*()_%2B-%3D{}[]|\\%3A%3B"\'<>%2C.%3F%2F~`∑πΔ∞≠≤≥±×÷√∫∂%24€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello%2C 世界! ¿Cómo estás%3F 123 %2B 456 %3D 579 ©️ 🌈%23%26';
        expect(status).toEqual(200);
        expect(response.args.all).toEqual(expectedChars);
        expect(reqConfig.url).toEqual(expectedUrl);
        expect(response.url).toEqual(expectedUrl);
    });

    it('should should have error with fully encoded URL with special characters', async () => {
        const url = 'https://httpbin.org/get?symbols=!@$%^*()_+-={}[]|\\:;"\'<>,.?/~` абвгдеёжзийклмнопрстуфхцчшщъыьэюя#&';
        const encodedUrl = encodeURIComponent(url);
        const config = {
            data: {
                method: 'GET',
                url: encodedUrl,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(200);
        expect(reqConfig.url).toEqual(encodedUrl);
        expect(response.url).toEqual(encodedUrl);
    });

    it('should handle URL with non-ASCII characters', async () => {
        const url = 'https://httpbin.org/get?text=こんにちは世界&emoji=🌍';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.url).toEqual(url);
        expect(response.args.text).toEqual('こんにちは世界');
        expect(response.args.emoji).toEqual('🌍');
    });

    it('should handle URL with fragment identifier', async () => {
        const fragment = '#section1';
        const urlWithoutFragment = `https://httpbin.org/get?param=value`;
        const url = `${urlWithoutFragment}${fragment}`;
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(200);
        expect(response.url).toEqual(urlWithoutFragment);
        expect(response.args.param).toEqual('value');
        expect(reqConfig.url).toEqual(url);
    });

    it('should handle URL with basic auth credentials', async () => {
        const url = 'https://user:pass@httpbin.org/basic-auth/user/pass';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;

        expect(status).toEqual(200);
        expect(response.authenticated).toEqual(true);
        expect(response.user).toEqual('user');
    });

    it('should handle URL with encoded Unicode characters', async () => {
        const unicodeChars = '你好世界😀🌍🚀';
        const encodedUrl = `https://httpbin.org/get?unicode=${encodeURIComponent(unicodeChars)}`;
        const config = {
            data: {
                method: 'GET',
                url: encodedUrl,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const response = output.Response;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(200);
        expect(reqConfig.url).toEqual(encodedUrl);
        expect(response.args.unicode).toEqual(unicodeChars);
    });

    it('should handle wrong URL', async () => {
        const url = 'https://httpbin.org/wrong-url';
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
            outputs: [{ name: 'Response', index: 0, default: true }],
        };
        const output = await apiCall.process({}, config, agent);
        const status = output.Status;
        const reqConfig = output.RequestConfig;

        expect(status).toEqual(404);
        expect(reqConfig.url).toEqual(url);
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
                    oauthService: 'None',
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
