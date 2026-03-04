import axios from 'axios';
import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { Agent } from '@sre/AgentManager/Agent.class';
import { APICall } from '@sre/Components/APICall/APICall.class';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { testData } from '../../utils/test-data-manager';
import { AccessCandidate, SmythFS } from 'index';

const app = express();
const BASE_URL = `http://agents-server.smyth.stage`;

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

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
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

const IMAGE_URL = 'https://app.smythos.dev/img/smythos-logo.png';

// TODO [Forhad]: Need to write more advance tests for URL
//- {{baseUrl}}/path/goes/here - baseUrl = https://httpbin.org
//- https://httpbin.org/{{path}} - path = /path/goes/here?q=some+query+params

describe('APICall Component - HTTP Methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    methods.forEach((method) => {
        it(`handle ${method} method`, async () => {
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
            };
            const output = await apiCall.process({}, config, agent);
            const headers = output.Headers;

            expect(headers).toBeInstanceOf(Object);
        });
    });
});

describe('APICall Component - Headers', () => {
    it('handle default headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
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
                url: 'https://httpbin.org/headers',
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
                url: 'https://httpbin.org/headers',
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
                url: 'https://httpbin.org/headers',
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

    it('resolve component template variable in headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: `{"Authorization": "Bearer {{VARVAULTINPUT:Authentication Key:[""]}}"}`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': DUMMY_KEY,
                },
            },

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

        expect(response.headers['Authorization']).toEqual(`Bearer ${DUMMY_KEY}`);
    });

    it('resolve vault key in headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
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

    it('resolve multiple variable types in headers', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://httpbin.org/headers',
                headers: `{
                    "Authorization": "Bearer ${VAULT_KEY_TEMPLATE_VAR}",
                    "X-User-Name": "{{name}}",
                    "X-Api-Key": '{{VARVAULTINPUT:Authentication Key:[""]}}'
                }`,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': DUMMY_KEY,
                },
            },

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

        const name = 'John Doe';

        const output = await apiCall.process({ name }, config, agent);
        const response = output.Response;

        expect(response.headers['Authorization']).toEqual(`Bearer ${DUMMY_KEY}`);
        expect(response.headers['X-User-Name']).toEqual(name);
        expect(response.headers['X-Api-Key']).toEqual(DUMMY_KEY);
    });
});

describe('APICall Component - URL Formats', () => {
    const url = 'https://httpbin.org/get?a=hello%20world&b=robot';

    it('handle URL with query parameters', async () => {
        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.args.a).toEqual('hello world');
        expect(response.args.b).toEqual('robot');
    });

    it('handle URL with array query parameters', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.args['ids[]']).toEqual(['1', '2', '3']);
        expect(response.url).toEqual(url);
    });

    it('handle URL with object query parameters', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.url).toEqual(url);
        expect(response.args['filter[age]']).toEqual('30');
        expect(response.args['filter[name]']).toEqual('John');
    });

    it('handle URL with multiple occurrences of the same parameter', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.url).toEqual(url);
        expect(response.args.color).toEqual(['red', 'blue', 'green']);
    });

    it('handle URL with nested object parameters', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.url).toEqual(url);
        expect(response.args['user[name][first]']).toEqual('John');
        expect(response.args['user[name][last]']).toEqual('Doe');
        expect(response.args['user[age]']).toEqual('30');
    });

    it('handle URL with empty parameter values', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.url).toEqual(url);
        expect(response.args.empty).toEqual('');
        expect(response.args.null).toEqual('');
        expect(response.args.undefined).toEqual('');
    });

    it('handle URL with encoded spaces and plus signs', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.args.message).toEqual('hello world');
        expect(response.args.operation).toEqual('1 1');
    });

    //#region test cases with symbols and special characters
    // * Note: Following commented test cases in includes characters that that could be used in very rare cases, we will check later
    /* it('handle URL with all types of raw characters and symbols', async () => {
        const allChars = `!@$%^*()_+-={}[]|\:;"'<>,.?/~\`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123 + 456 = 579 ©️ 🌈#&`; // we should keep # and & in the end of the string for it's special meaning in URL
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
            
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        // The expected arguments and URL encoding differs between browsers and Postman, We're expecting the Postman version.
        const expectedChars = `!@$%^*()_ -={}[]|\\:;\"'<>,.?/~\`\u2211\u03c0\u0394\u221e\u2260\u2264\u2265\u00b1\u00d7\u00f7\u221a\u222b\u2202$\u20ac\u00a3\u00a5\u20b9\u20bd\u20a9\u20aa\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00e7\u00e3\u00f5\u00e2\u00ea\u00ee\u00f4\u00fb\u00e4\u00eb\u00ef\u00f6\u00fc\ud83d\ude00\ud83c\udf0d\ud83d\ude80\ud83c\udf89\ud83c\udf55\ud83d\udc31\u200d\ud83d\udc64\u00a9\u00ae\u2122\u2665\u2660\u2663\u2666\u2622\u2623\u262e\u262fHello, \u4e16\u754c! \u00bfC\u00f3mo est\u00e1s? 123   456 = 579 \u00a9\ufe0f \ud83c\udf08`;
        const expectedUrl = `https://httpbin.org/get?all=!%40$%^*()_+-={}[]|\\:%3B\"'<>,.%3F%2F~\`\u2211\u03c0\u0394\u221e\u2260\u2264\u2265\u00b1\u00d7\u00f7\u221a\u222b\u2202$\u20ac\u00a3\u00a5\u20b9\u20bd\u20a9\u20aa\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00e7\u00e3\u00f5\u00e2\u00ea\u00ee\u00f4\u00fb\u00e4\u00eb\u00ef\u00f6\u00fc\ud83d\ude00\ud83c\udf0d\ud83d\ude80\ud83c\udf89\ud83c\udf55\ud83d\udc31\u200d\ud83d\udc64\u00a9\u00ae\u2122\u2665\u2660\u2663\u2666\u2622\u2623\u262e\u262fHello, \u4e16\u754c! \u00bfC\u00f3mo est\u00e1s%3F 123 + 456 = 579 \u00a9\ufe0f \ud83c\udf08`;

        expect(response.args.all).toEqual(expectedChars);
        expect(response.url).toEqual(expectedUrl);
    });

    it('handle URL with all types of encoded characters and symbols', async () => {
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
            
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        const expectedChars =
            '!@$%^*()_+-={}[]|\\:;"\'<>,.?/~`∑πΔ∞≠≤≥±×÷√∫∂$€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello, 世界! ¿Cómo estás? 123 + 456 = 579 ©️ 🌈#&';
        const expectedUrl =
            'https://httpbin.org/get?all=!%40%24%25^*()_%2B-%3D{}[]|\\%3A%3B"\'<>%2C.%3F%2F~`∑πΔ∞≠≤≥±×÷√∫∂%24€£¥₹₽₩₪áéíóúñüçãõâêîôûäëïöü😀🌍🚀🎉🍕🐱‍👤©®™♥♠♣♦☢☣☮☯Hello%2C 世界! ¿Cómo estás%3F 123 %2B 456 %3D 579 ©️ 🌈%23%26';

        expect(response.args.all).toEqual(expectedChars);
        expect(response.url).toEqual(expectedUrl);
    }); */
    //#endregion test cases with symbols and special characters

    it('handle URL with common symbols and special characters', async () => {
        const specialChars = "!@$'()*+,;=-._~:/?[]#&";
        const url = `https://httpbin.org/get?special=${specialChars}`;

        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        const expectedSpecialChars = "!@$'()* ,;=-._~:/?[]";
        const expectedUrl = "https://httpbin.org/get?special=!%40$'()* ,%3B=-._~:%2F%3F[]";

        expect(response.args.special).toEqual(expectedSpecialChars);
        expect(response.url).toEqual(expectedUrl);
    });

    it('handle URL with encoded common symbols and special characters', async () => {
        const specialChars = "!@$'()*,;=-._~:/?[]";
        const url = `https://httpbin.org/get?special=${encodeURIComponent(specialChars)}`;

        const config = {
            data: {
                method: 'GET',
                url,
                headers: '',
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        const expectedSpecialChars = "!@$'()*,;=-._~:/?[]";

        expect(response.args.special).toEqual(expectedSpecialChars);

        // TODO: We have difference in returned URL and expected URL for some of the special characters. Need to check it later.
        // response.url is "https://httpbin.org/get?special=!%40$'()*,%3B=-._~:%2F%3F[]";
        // const expectedUrl = "https://httpbin.org/get?special=!%40%24'()*%2C%3B%3D-._~%3A%2F%3F[]"; // According to Postman

        // expect(response.url).toEqual(expectedUrl);
    });

    it('handle URL with fragment identifier', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.url).toEqual(urlWithoutFragment);
        expect(response.args.param).toEqual('value');
    });

    it('handle URL with basic auth credentials', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.authenticated).toEqual(true);
        expect(response.user).toEqual('user');
    });

    it('handle wrong URL', async () => {
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
        };
        const output = await apiCall.process({}, config, agent);

        expect(output._error).toBeDefined();
        expect(output._error).toContain('404');
    });

    it('resolve input template variable in URL', async () => {
        const user = 'John Doe';
        const url = 'https://httpbin.org/get?user={{user}}';
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };
        const output = await apiCall.process({ user }, config, agent);
        const response = output.Response;

        expect(response.args.user).toEqual(user);
        expect(response.url).toEqual(`https://httpbin.org/get?user=${user}`);
    });

    it('resolve component template variable in URL', async () => {
        const url = 'https://httpbin.org/get?key={{VARVAULTINPUT:Authentication Key:[""]}}';
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': DUMMY_KEY,
                },
            },
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

        expect(response.args.key).toEqual(DUMMY_KEY);
        expect(response.url).toEqual(`https://httpbin.org/get?key=${DUMMY_KEY}`);
    });

    it('resolve vault key in URL', async () => {
        const url = `https://httpbin.org/get?key=${VAULT_KEY_TEMPLATE_VAR}`;
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
            },
        };

        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.args.key).toEqual(DUMMY_KEY);
        expect(response.url).toEqual(`https://httpbin.org/get?key=${DUMMY_KEY}`);
    });

    it('resolve multiple variable types in URL', async () => {
        const url = `https://httpbin.org/get?user={{user}}&key={{VARVAULTINPUT:Authentication Key:[""]}}&secret=${VAULT_KEY_TEMPLATE_VAR}`;
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': DUMMY_KEY,
                },
            },
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
        const user = 'John Doe';
        const output = await apiCall.process({ user }, config, agent);
        const response = output.Response;

        expect(response.args.user).toEqual(user);
        expect(response.args.key).toEqual(DUMMY_KEY);
        expect(response.args.secret).toEqual(DUMMY_KEY);
    });

    it('resolve smythfs:// URI in public URL', async () => {
        // write a file in Smyth File System (will be used to test smythfs:// uris passed as arguments)
        await SmythFS.Instance.write('smythfs://Team2.team/agent-123456/_temp/file.txt', 'Hello, world!', AccessCandidate.agent('agent-123456'));
        const url = 'https://httpbin.org/get?image=smythfs://Team2.team/agent-123456/_temp/file.txt';
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                headers: '',
            },
        };

        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        const regex = new RegExp(`${BASE_URL}`);

        // delete the file
        await SmythFS.Instance.delete('smythfs://Team2.team/agent-123456/_temp/file.txt', AccessCandidate.agent('agent-123456'));
        expect(response.args.image).toMatch(regex);
    });

    it('does not resolve smythfs:// URI if it does not belong to the agent', async () => {
        await SmythFS.Instance.write('smythfs://Team2.team/agent-007/_temp/file.txt', 'Hello, world!', AccessCandidate.agent('agent-007'));
        const url = 'https://httpbin.org/get?image=smythfs://AnotherTeam.team/agent-007/_temp/M4I8A5XIDKJ.jpeg';
        const config = {
            data: {
                method: 'GET',
                url,
                contentType: 'none',
                oauthService: 'None',
                body: '',
                headers: '',
            },
        };

        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        const regex = new RegExp(`${BASE_URL}`);
        // delete the file
        await SmythFS.Instance.delete('smythfs://Team2.team/agent-007/_temp/file.txt', AccessCandidate.agent('agent-007'));
        expect(response).toBeUndefined();
        expect(output).toHaveProperty('_error');
        expect(output._error).toContain('Access Denied');
    });
});

describe('APICall Component - Content Types', () => {
    const contentTypes = ['none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain'];
    contentTypes.forEach((contentType) => {
        it(`handle ${contentType} content type`, async () => {
            const config = {
                data: {
                    method: 'GET',
                    url: 'https://httpbin.org/get',
                    headers: '',
                    contentType,
                    oauthService: 'None',
                },
            };
            const output = await apiCall.process({}, config, agent);
            const response = output.Response;

            const expectedContentType = contentType === 'none' ? undefined : contentType;
            expect(response.headers['Content-Type']).toEqual(expectedContentType);
        });
    });
});

describe('APICall Component - Body', () => {
    it('handle application/json content type', async () => {
        const body = { name: 'John Doe', age: 30 };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
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
                url: 'https://httpbin.org/post',
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
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'text/plain',
                body: 'Hello, world!',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('text/plain');
        expect(response.data).toEqual('Hello, world!');
    });

    const fetchFileInfoAndContent = async (fileUrl: string): Promise<{ mimetype: string; size: number; buffer: Buffer | null }> => {
        if (!fileUrl) return { mimetype: '', size: 0, buffer: null };

        try {
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const data = response.data || '';
            const buffer = Buffer.from(data, 'binary');
            const size = buffer.byteLength;

            return { mimetype: response.headers['content-type'], size, buffer };
        } catch (error: any) {
            return { mimetype: '', size: 0, buffer: null };
        }
    };

    it('handle multipart/form-data with base64 input', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'image',
                    type: 'Binary',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };

        const { mimetype, buffer } = await fetchFileInfoAndContent(IMAGE_URL);

        // Convert buffer to base64 URL
        const base64Data = buffer ? buffer.toString('base64') : '';
        const base64Url = `data:${mimetype};base64,${base64Data}`;

        const output = await apiCall.process({ image: base64Url }, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle multipart/form-data with SmythFile object input', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
        };

        const { mimetype, size } = await fetchFileInfoAndContent(IMAGE_URL);

        const output = await apiCall.process(
            {
                image: {
                    mimetype,
                    size,
                    url: IMAGE_URL,
                },
            },
            config,
            agent
        );
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle multipart/form-data with SmythFile object input as Binary type', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'image',
                    type: 'Binary',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };

        const { mimetype, size } = await fetchFileInfoAndContent(IMAGE_URL);

        const output = await apiCall.process(
            {
                image: {
                    mimetype,
                    size,
                    url: IMAGE_URL,
                },
            },
            config,
            agent
        );
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle multipart/form-data with smythfs:// URI', async () => {
        const imageData = testData.readBinaryData('smythos.png');
        await SmythFS.Instance.write('smythfs://Team2.team/agent-123456/_temp/smythos.png', imageData, AccessCandidate.agent('agent-123456'));

        const input = {
            image: {
                mimetype: 'image/png',
                size: 13179,
                url: 'smythfs://Team2.team/agent-123456/_temp/smythos.png',
                name: 'smythos.png',
            },
        };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                contentType: 'multipart/form-data',
                body: '{"image": "{{image}}"}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'image',
                    type: 'Binary',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };

        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        // delete the file
        await SmythFS.Instance.delete('smythfs://Team2.team/agent-123456/_temp/smythos.png', AccessCandidate.agent('agent-123456'));

        expect(response.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(response).toHaveProperty('files');
        expect(response.files).toHaveProperty('image');
        expect(response.files.image).toMatch(/^data:image\/png;base64,/);
    });

    it('handle binary content type with base64 input', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'binary',
                body: '{{file}}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'file',
                    type: 'Binary',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };

        const { mimetype, size, buffer } = await fetchFileInfoAndContent(IMAGE_URL);

        // Convert buffer to base64 URL
        const base64Data = buffer ? buffer.toString('base64') : '';
        const base64Url = `data:${mimetype};base64,${base64Data}`;

        const output = await apiCall.process({ file: base64Url }, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(mimetype);
        expect(response.headers['Content-Length']).toEqual(size.toString());
        // for some reason httpbin returns data as application/octet-stream
        expect(response.data).toMatch(/^data:application\/octet-stream;base64,/);
    });

    it('handle binary with SmythFile object', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'binary',
                body: '{{file}}',
                oauthService: 'None',
            },
        };

        const { mimetype, size } = await fetchFileInfoAndContent(IMAGE_URL);

        const output = await apiCall.process(
            {
                file: {
                    mimetype,
                    size,
                    url: IMAGE_URL,
                },
            },
            config,
            agent
        );
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(mimetype);
        expect(response.headers['Content-Length']).toEqual(size.toString());
        // for some reason httpbin returns data as application/octet-stream
        expect(response.data).toMatch(/^data:application\/octet-stream;base64,/);
    });

    it('handle binary with SmythFile object as binary input', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'binary',
                body: '{{file}}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'file',
                    type: 'Binary',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };

        const { mimetype, size } = await fetchFileInfoAndContent(IMAGE_URL);

        const output = await apiCall.process(
            {
                file: {
                    mimetype,
                    size,
                    url: IMAGE_URL,
                },
            },
            config,
            agent
        );
        const response = output.Response;

        expect(response.headers['Content-Type']).toMatch(mimetype);
        expect(response.headers['Content-Length']).toEqual(size.toString());
        // for some reason httpbin returns data as application/octet-stream
        expect(response.data).toMatch(/^data:application\/octet-stream;base64,/);
    });

    it('handle empty body', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'none',
                body: '',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toEqual('application/x-www-form-urlencoded');
        expect(response.data).toEqual('');
        expect(response.headers['Content-Length']).toEqual('0');
    });

    it('handle application/xml content type', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/xml',
                body: '<root><name>John Doe</name><age>30</age></root>',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('application/xml');
        expect(response.data).toContain('<root><name>John Doe</name><age>30</age></root>');
    });

    // TODO [Forhad]: Need to make it work
    it('resolve input template variable in body', async () => {
        const body = { name: 'John Doe', age: 30 };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{{body}}',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({ body: JSON.stringify(body) }, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json).toEqual(body);
    });

    it('resolve input template variable inside body properties', async () => {
        const name = 'John Doe';
        const age = 30;
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{name: "{{name}}", age: {{age}}}',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({ name, age }, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json).toEqual({ name, age });
    });

    it('resolve input template variable in body with URL Encoded content type', async () => {
        const url = 'https://httpbin.org/post';
        const config = {
            data: {
                method: 'POST',
                url,
                headers: '',
                contentType: 'application/x-www-form-urlencoded',
                body: `{\n  \"To\": \"{{to}}\",\n  \"From\": \"{{from}}\",\n  \"Body\": \"{{body}}\"\n}`,
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'to',
                    type: 'Number',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
                {
                    name: 'from',
                    type: 'Any',
                    color: '#F35063',
                    optional: false,
                    index: 1,
                    default: false,
                },
                {
                    name: 'body',
                    type: 'Any',
                    color: '#F35063',
                    optional: false,
                    index: 2,
                    default: false,
                },
            ],
        };

        const to = '123456789';
        const from = '987654321';
        const body = 'Hello, how are you?';
        const input = {
            to,
            from,
            body,
        };
        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        expect(response.form.To).toEqual(to);
        expect(response.form.From).toEqual(from);
        expect(response.form.Body).toEqual(body);

        expect(response.url).toEqual(url);
    });

    it('resolve component template variable in body', async () => {
        const userData = { name: 'John Doe', age: 30 };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{{VARVAULTINPUT:User Data:[""]}}',
                oauthService: 'None',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': JSON.stringify(userData),
                },
            },
            template: {
                settings: {
                    'VARVAULTINPUT-LTH3E8AB028': {
                        id: 'VARVAULTINPUT-LTH3E8AB028',
                        type: 'INPUT',
                        label: 'User Data',
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

        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json).toEqual(userData);
    });

    it('resolve vault key in body', async () => {
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: `{"key": ${VAULT_KEY_TEMPLATE_VAR}}`,
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json.key).toEqual(DUMMY_KEY);
    });

    it('resolve multiple variable types in Body', async () => {
        const userName = 'John Doe';
        const userData = { name: userName, age: 30 };

        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: `{"name": "{{name}}", "userData": {{VARVAULTINPUT:User Data:[""]}}, "key": ${VAULT_KEY_TEMPLATE_VAR}}`,
                oauthService: 'None',
                _templateVars: {
                    'VARVAULTINPUT-LTH3E8AB028': JSON.stringify(userData),
                },
            },
            template: {
                settings: {
                    'VARVAULTINPUT-LTH3E8AB028': {
                        id: 'VARVAULTINPUT-LTH3E8AB028',
                        type: 'INPUT',
                        label: 'User Data',
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

        const output = await apiCall.process({ name: userName }, config, agent);
        const response = output.Response;

        expect(response.headers['Content-Type']).toContain('application/json');
        expect(response.json).toEqual({
            name: userName,
            userData: userData,
            key: DUMMY_KEY,
        });
    });

    it(`should handle falsy values (0, '', false) correctly in request body`, async () => {
        const input = {
            num: '0',
            int: '0.11',
            str: '',
            bool: 'false',
        };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{\n    "number": {{num}},\n    "integer": {{int}},\n    "string": "{{str}}",\n    "boolean": {{bool}}\n}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'num',
                    type: 'Number',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
                {
                    name: 'int',
                    type: 'Integer',
                    color: '#F35063',
                    optional: false,
                    index: 1,
                    default: false,
                },
                {
                    name: 'str',
                    type: 'String',
                    color: '#F35063',
                    optional: false,
                    index: 2,
                    default: false,
                },
                {
                    name: 'bool',
                    type: 'Boolean',
                    color: '#F35063',
                    optional: false,
                    index: 3,
                    default: false,
                },
            ],
        };
        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        expect(response.json.integer).toEqual(0);
        expect(response.json.number).toEqual(0);
        expect(response.json.string).toEqual('');
        expect(response.json.boolean).toEqual(false);
    });

    it('should handle request body with only template variable that hold object', async () => {
        const input = {
            obj: {
                name: 'test1',
                email: 'test1@example.com',
                age: 30,
            },
        };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{{obj}}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'obj',
                    type: 'Object',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
            ],
        };
        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        expect(response.json).toEqual(input.obj);
    });

    it('should resolve template variables containing objects', async () => {
        const input = {
            obj: {
                name: 'test1',
                email: 'test1@example.com',
                age: 30,
            },
            nestedObj: {
                name: 'test2',
                email: 'test1@example.com',
                age: 40,
            },
        };
        const config = {
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'application/json',
                body: '{\n    "obj": {{obj}},\n    "nestedObj": {{nestedObj}}\n}',
                oauthService: 'None',
            },
            inputs: [
                {
                    name: 'obj',
                    type: 'Object',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: false,
                },
                {
                    name: 'nestedObj',
                    type: 'Object',
                    color: '#F35063',
                    optional: false,
                    index: 1,
                    default: false,
                },
            ],
        };
        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        expect(response.json.obj).toEqual(input.obj);
        expect(response.json.nestedObj).toEqual(input.nestedObj);
    });

    it('should resolve template variables containing array', async () => {
        const input = {
            arr: ['Item1', 'Item2', 'Item3', 'Item4', 'Item5'],
        };
        const config = {
            data: {
                method: 'POST',
                contentType: 'application/json',
                oauthService: 'None',
                url: 'https://httpbin.org/post',
                headers: '',
                body: '{\n  "arr": {{arr}}\n}',
            },
            inputs: [
                {
                    name: 'arr',
                    type: 'Array',
                    color: '#F35063',
                    optional: false,
                    defaultVal: '{{array}}',
                    index: 0,
                    default: false,
                },
            ],
        };
        const output = await apiCall.process(input, config, agent);
        const response = output.Response;

        expect(response.json.arr).toEqual(input.arr);
    });
});

/*
//OAuth tests and proxy tests need to be re-implemented
//the oauth approach below is deprecated

describe('APICall Component - OAuth', () => {
    it('handle OAuth2 authentication', async () => {
        const config = {
            id: 'M1LWWLNL1V',
            name: 'APICall',
            title: 'OAuth2 with Google',
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'none',
                body: '',
                proxy: '',
                oauthService: 'Google',
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
                authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenURL: 'https://oauth2.googleapis.com/token',
                clientID: '{{KEY(Google Client ID)}}',
                clientSecret: '{{KEY(Google Client Secret)}}',
                requestTokenURL: '',
                accessTokenURL: '',
                userAuthorizationURL: '',
                consumerKey: '',
                consumerSecret: '',
                authenticate: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;

        expect(response.headers['Authorization']).toMatch(/^Bearer .{200,}$/);
    });

    it('handle OAuth1 authentication', async () => {
        const config = {
            id: 'CM1LXC1LAZV9',
            name: 'APICall',
            title: 'OAuth1 with X',
            data: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                headers: '',
                contentType: 'none',
                body: '',
                proxy: '',
                oauthService: 'Twitter',
                scope: '',
                authorizationURL: '',
                tokenURL: '',
                clientID: '',
                clientSecret: '',
                requestTokenURL: 'https://api.twitter.com/oauth/request_token',
                accessTokenURL: 'https://api.twitter.com/oauth/access_token',
                userAuthorizationURL: 'https://api.twitter.com/oauth/authorize',
                consumerKey: '{{KEY(X Consumer Key)}}',
                consumerSecret: '{{KEY(X Consumer Secret)}}',
                authenticate: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        const response = output.Response;
        expect(response.headers['Authorization']).toMatch(
            /OAuth oauth_consumer_key="[^"]+", oauth_nonce="[^"]+", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="[^"]+", oauth_token="[^"]+", oauth_version="1.0"/
        );
    });
});

describe('APICall Component - Proxy', () => {
    const proxyHost = '207.244.217.165';

    function handleProxy(scheme: string, proxyUrl: string) {
        it(`handle proxy settings with ${scheme} protocol`, async () => {
            const config = {
                data: {
                    method: 'GET',
                    url: 'https://httpbin.org/get',
                    headers: '',
                    contentType: 'none',
                    body: '',
                    proxy: proxyUrl,
                    oauthService: 'None',
                },
            };
            const output = await apiCall.process({}, config, agent);
            const response = output.Response;
            const headers = output.Headers;

            expect(headers['access-control-allow-credentials']).toEqual('true');
            expect(response.origin).toEqual(proxyHost);
        });
    }

    const proxyUser = '{{KEY(WEBSHARE PROXY USERNAME)}}';
    const proxyPass = '{{KEY(WEBSHARE PROXY PASSWORD)}}';
    const proxyPort = 6712;

    const proxyUrls = {
        http: `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`,
        socks5: `socks5://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`,
        multiple: `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}\nsocks5://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`,
    };

    for (const [scheme, proxyUrl] of Object.entries(proxyUrls)) {
        handleProxy(scheme, proxyUrl);
    }
});
*/
describe('APICall Component - Error Handling', () => {
    it('handle network errors', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'https://invalid.url',
                headers: '',
                contentType: 'none',
                body: '',
                oauthService: 'None',
            },
        };
        const output = await apiCall.process({}, config, agent);
        expect(output._error).toContain('ENOTFOUND');
    });

    it('handle invalid URL errors', async () => {
        const config = {
            data: {
                method: 'GET',
                url: 'invalid-url',
                headers: '',
                contentType: 'none',
                body: '',
            },
        };
        const output = await apiCall.process({}, config, agent);
        expect(output._error).toContain('Invalid URL');
    });
});
