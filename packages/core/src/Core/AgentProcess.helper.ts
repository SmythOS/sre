import Agent from '@sre/AgentManager/Agent.class';
import SmythRuntime from './SmythRuntime.class';
import { uid } from '../utils';
import AgentSettings from '@sre/AgentManager/AgentSettings.class';
import AgentRequest from '@sre/AgentManager/AgentRequest.class';
import { TAgentProcessParams } from '@sre/types/Agent.types';

import { parseCLIArgs } from '@sre/utils/cli.utils';
import path from 'path';
import fs from 'fs';
import * as FileType from 'file-type';
import mime from 'mime';
export class AgentProcess {
    public agent: Agent;

    private _loadPromise: Promise<any>;

    private constructor(private agentData: any) {
        this.initAgent(agentData);
    }
    private async initAgent(agentData: any) {
        let data;
        let agentId;

        if (typeof agentData === 'object') {
            data = agentData;
            if (data.components && data.connections) {
                data = { data, version: '1.0' };
            }

            agentId = data.data.id || 'tmp-' + uid();
        } else {
            const jsonRegex = /^{.*}$/g;
            const jsonData = agentData.match(jsonRegex)?.[0];

            const idRegex = /^[a-zA-Z0-9\-]+$/g;
            agentId = agentData.match(idRegex)?.[0];

            //We are loading from an agentId
            if (agentId) {
                data = await SmythRuntime.Instance.AgentData.getAgentData(agentId, 'latest');
            }

            //we are loading an agent from provided data
            if (!data && jsonData) {
                data = JSON.parse(jsonData);
                //generate an agentId if not provided
                agentId = data.id || 'tmp-' + uid();

                if (data.components && data.connections) {
                    data = { data, version: '1.0' };
                }
            }
        }

        const agentSettings = new AgentSettings(agentId);
        this.agent = new Agent(agentId, data, agentSettings);
    }

    public async ready() {
        if (this._loadPromise) {
            return this._loadPromise;
        }

        return (this._loadPromise = new Promise((resolve) => {
            let maxWait = 10000;
            //wait for agent to be set
            const itv = setInterval(() => {
                if (this.agent) {
                    clearInterval(itv);
                    resolve(true);
                }
                maxWait -= 100;
                if (maxWait <= 0) {
                    clearInterval(itv);
                    resolve(false);
                }
            }, 100);
        }));
    }

    public static load(agentData: any) {
        const agentProcess = new AgentProcess(agentData);
        return agentProcess;
    }

    public async run(reqConfig: TAgentProcessParams | Array<string> | AgentRequest) {
        await this.ready();
        if (!this.agent) throw new Error('Failed to load agent');
        let request: AgentRequest = this.parseReqConfig(reqConfig);

        this.agent.setRequest(request);

        const pathMatches = request.path.match(/(^\/v[0-9]+\.[0-9]+?)?(\/api\/(.+)?)/);
        if (!pathMatches || !pathMatches[2]) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }
        const endpointPath = pathMatches[2];
        const input = request.method == 'GET' ? request.query : request.body;
        const result: any = await this.agent.process(endpointPath, input).catch((error) => ({ error: error.message }));

        return result;
    }

    public reset() {
        //the current version of agent cannot be used to run multiple requests
        //as a workaround we provide this function to reset AgentProcess state by generating a new Agent
        //TODO: refactor Agent.class in order to allow multiple consecutive requests running
        this.initAgent(this.agentData);
    }

    private parseReqConfig(reqConfig: TAgentProcessParams | Array<string> | AgentRequest): AgentRequest {
        if (reqConfig instanceof AgentRequest) return reqConfig;
        if (Array.isArray(reqConfig)) return this.parseCLI(reqConfig);
        return new AgentRequest(reqConfig);
    }

    private parseCLI(argList: Array<string>): AgentRequest {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        const cli = parseCLIArgs(['endpoint', 'post', 'get', 'put', 'delete', 'patch', 'head', 'options', 'headers', 'session'], argList);
        const usedMethod = methods.find((method) => cli[method]);

        const req: AgentRequest = new AgentRequest();

        req.method = usedMethod?.toUpperCase() || 'GET';
        req.body = {};
        req.query = {};

        switch (usedMethod) {
            case 'get':
            case 'delete':
            case 'head':
            case 'options':
                req.query = cli[usedMethod];
                break;
            case 'post':
            case 'put':
            case 'patch':
                req.body = cli[usedMethod];
                break;
        }

        req.path = `/api/${cli.endpoint}`;
        req.params = cli.endpoint?.split('/');

        req.headers = cli.headers || {};
        //convert all keys to lowercase
        for (let key in req.headers) {
            req.headers[key.toLowerCase()] = req.headers[key];
            delete req.headers[key];
        }

        req.sessionID = cli.session || uid();

        req.files = [];
        if (req.body) {
            for (let entry in req.body) {
                let value = req.body[entry];
                const filePath = path.join(process.cwd(), value);
                const fileName = path.basename(filePath);
                if (!fs.existsSync(filePath)) continue;

                //read the file and create a file object

                try {
                    // Read the file content
                    const fileBuffer = fs.readFileSync(filePath);
                    const ext: any = fileName.split('.').pop();

                    const fileObj = {
                        fieldname: entry,
                        originalname: fileName,
                        buffer: fileBuffer,
                        mimetype: mime.getType(ext) || 'application/octet-stream',
                    };

                    delete req.body[entry];
                    req.files.push(fileObj);

                    // Try to determine the MIME type from the file content
                    FileType.fileTypeFromBuffer(fileBuffer).then((fileType) => {
                        if (fileType) {
                            fileObj.mimetype = fileType.mime;
                        }
                    });
                } catch (error) {
                    console.warn('Coud not read file', filePath, error.message);
                }
            }
        }

        return req;
    }

    public async post(path: string, input?: any, headers?: any) {
        return this.run({ method: 'POST', path, body: input || {}, headers });
    }

    public async get(path: string, query?: any, headers?: any) {
        return this.run({ method: 'GET', path, query, headers });
    }
}
