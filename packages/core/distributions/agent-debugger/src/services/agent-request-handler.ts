import { Request, Response } from 'express';
import axios from 'axios';

import { createLogger } from '../services/logger';
import { AgentProcess } from '../../../../src/Core/AgentProcess.helper';
import { ConnectorService } from '../../../../src/index.ts';
const console = createLogger('___FILENAME___');

const debugPromises: any = {}; //TODO : persist this ?

export function getDebugSession(id) {
    return debugPromises[id]?.dbgSession;
}
export async function processAgentRequest(agentId: string, req: any) {
    const agentDataConnector = ConnectorService.getAgentDataConnector();
    const data = await agentDataConnector.getAgentData(agentId);
    const agentProcess = AgentProcess.load(data);
    if (!agentProcess) {
        return { status: 404, data: 'Agent not found' };
    }
    //const req = agent.agentRequest;

    req.socket.on('close', () => {
        // console.log('Client socket closed, killing agent');
        // Handle the cancellation logic
        agentProcess.agent.kill();
    });

    const skipDebug = typeof req.header('X-DEBUG-SKIP') != 'undefined';

    const readStateId: string = req.header('X-DEBUG-READ') || '';
    if (readStateId) {
        try {
            console.log('readStateId', readStateId);
            const result = await agentProcess.readDebugState(readStateId, {
                ...req,
                path: req.url,
                url: undefined,
                headers: {
                    ...req.headers,
                },
            });
            console.log('result', result);
            return { status: 200, data: result };
        } catch (error: any) {
            console.error(error);
            return { status: 400, data: 'Agent State Unavailable' };
        }
    }

    let startLiveDebug = false;

    if (!skipDebug) {
        startLiveDebug =
            req._agent.usingTestDomain &&
            req._agent.debugSessionEnabled &&
            typeof req.header('X-DEBUG-RUN') == 'undefined' &&
            typeof req.header('X-DEBUG-read') == 'undefined' &&
            typeof req.header('X-DEBUG-INJ') == 'undefined' &&
            typeof req.header('X-DEBUG-STOP') == 'undefined';
    }

    if (startLiveDebug) {
        return runAgentDebug(agentId, req);
    } else {
        return runAgentProcess(agentId, agentProcess, req);
    }
}

async function runAgentProcess(agentId: string, agentProcess: AgentProcess, req: any) {
    try {
        //const req = agent.agentRequest;
        const debugPromiseId = `${agentId}`;

        if (req.header('X-DEBUG-STOP')) {
            if (debugPromises[debugPromiseId]) {
                const dbgPromise: any = debugPromises[debugPromiseId];
                delete debugPromises[debugPromiseId];
                dbgPromise.resolve({ status: 400, error: 'Debug Session Stopped' });
            }
        }

        //extract endpoint path
        //live agents (dev) do not have a version number
        //deployed agents have a version number
        const pathMatches = req.path.match(/(^\/v[0-9]+\.[0-9]+?)?(\/api\/(.+)?)/);
        if (!pathMatches || !pathMatches[2]) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }
        const endpointPath = pathMatches[2];
        const input = req.method == 'GET' ? req.query : req.body;
        // const result: any = await agent.process(endpointPath, input).catch((error) => ({ error }));

        const { data: result } = await agentProcess
            .run({
                ...req,
                path: req.url,
                url: undefined,
                headers: {
                    ...req.headers,
                    'X-DEBUG-RUN': '',
                },
            })
            .catch((error) => ({ data: { error: error.toString() } }));

        if (result.error) {
            console.error('ERROR', result.error);
            //res.status(500).json({ ...result, error: result.error.toString(), agentId: agent.id, agentName: agent.name });
            return {
                status: 500,
                data: {
                    ...result,
                    error: result.error.toString(),
                    agentId: agentId,
                    // agentName: agent?.name
                    agentName: undefined,
                },
            };
        }
        //handle API embodiments debug response
        const dbgSession = result?.dbgSession || result?.expiredDbgSession || '';
        if (dbgSession && debugPromises[debugPromiseId]) {
            const dbgPromise: any = debugPromises[debugPromiseId];

            if (result.finalResult) {
                //const result = debugPromises[agent.id].result;
                delete debugPromises[debugPromiseId];
                dbgPromise.resolve(result.finalResult);
            }
        }
        return { status: 200, data: result };
    } catch (error: any) {
        console.error(error);
        if (error.response) {
            // The request was made, but the server responded with a non-2xx status
            return { status: error.response.status, data: error.response.data };
        } else {
            // Some other error occurred
            return { status: 500, data: 'Internal Server Error' };
        }
    }
}
async function runAgentDebug(agentId: string, req: Request) {
    try {
        //const req = agent.agentRequest;
        const debugPromiseId = `${agentId}`;

        const excludedHeaders = ['host', 'content-length', 'accept-encoding'];
        const headers = Object.keys(req.headers)
            .filter((header) => !excludedHeaders.includes(header.toLowerCase()))
            .reduce((obj, header) => {
                obj[header] = req.headers[header];
                return obj;
            }, {});
        headers['X-AGENT-ID'] = agentId;
        headers['X-DEBUG-RUN'] = '';

        //'X-DEBUG-RUN': '',
        const port = process.env.PORT || 3000;

        let url = `http://localhost:${port}${req.path.replace('/debug', '/api')}`;
        //add query params
        // * query params will add with 'params' property in axios to parse Object type data properly
        /* if (req.query) {
            const query = Object.keys(req.query)
                .map((key) => `${key}=${req.query[key]}`)
                .join('&');
            url += `?${query}`;
        } */

        const input = req.method == 'GET' ? req.query : req.body;

        //check if request has form-data

        //the following line does not handle get request case
        //const apiResponse = await axios.post(url, input, { headers }); //call the actual agentAPI locally

        let apiResponse;
        //make sure to map binary data back to the request body that we'll send to the agent
        // @ts-ignore
        if (req.files) {
            //send request with formData
            const formData = new FormData();
            //@ts-ignore
            for (let file of req.files) {
                const fieldname = file.fieldname;
                //get blob from file.buffer
                const blob = new Blob([file.buffer], { type: file.mimetype });

                formData.append(fieldname, blob, file.originalname);
            }
            for (let entry in req.body) {
                formData.append(entry, req.body[entry]);
            }

            apiResponse = await axios({
                method: req.method,
                url,
                data: formData,
                headers,
                params: req.query,
            });
        } else {
            //send request with json body
            apiResponse = await axios({
                method: req.method,
                url,
                data: req.body,
                headers,
                params: req.query,
            });
        }
        //const apiAgentResponse = await runAgentProcess(agent); //TODO : refactor the internal logic to use runAgentProcess() instead of making a post request
        const dbgSession = apiResponse?.data?.dbgSession;
        if (dbgSession) {
            //const agentId = agent.id;
            if (debugPromises[debugPromiseId]) {
                return {
                    status: 400,
                    data: { error: 'Debug Session Already Running', details: { debugPromiseId, session: debugPromises[debugPromiseId].dbgSession } },
                };
            }
            const sessionPromise = new Promise((resolve, reject) => {
                debugPromises[debugPromiseId] = { dbgSession, resolve, reject };
                //promise expiration
                setTimeout(
                    () => {
                        delete debugPromises[debugPromiseId];
                        reject({ status: 500, data: 'Debug Session Expired' });
                    },
                    60 * 60 * 1000 // 1 hour
                );
            });

            const finalResult: any = await sessionPromise.catch((error) => ({ error }));
            if (finalResult?.error) {
                return { status: finalResult.status || 500, data: { error: finalResult.error } };
            }

            let data = finalResult;

            return { status: 200, data };
        }
        //res.status(apiResponse.status).send(apiResponse.data);
    } catch (error: any) {
        if (error.response) {
            // The request was made, but the server responded with a non-2xx status
            console.error(error.response.status, error.response.data);
            return { status: error.response.status, data: error.response.data };
        } else {
            // Some other error occurred
            console.error(error);
            return { status: 500, data: 'Internal Server Error' };
        }
    }
}
