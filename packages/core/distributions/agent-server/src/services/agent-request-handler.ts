import { Request, Response } from 'express';
import axios from 'axios';

import { createLogger } from '../services/logger';
import { sreAdapter } from './sre-adapter';
const console = createLogger('___FILENAME___');

export async function processAgentRequest(agent: any, req: Request) {
    if (!agent) {
        return { status: 404, data: 'Agent not found' };
    }
    //const req = agent.agentRequest;

    req.socket.on('close', () => {
        // console.log('Client socket closed, killing agent');
        // Handle the cancellation logic
        // agent.kill();
    });

    const hasDebugHeader = ['X-DEBUG-RUN', 'X-DEBUG-read', 'X-DEBUG-INJ', 'X-DEBUG-STOP'].some((header) => req.header(header));

    if (hasDebugHeader) {
        return { status: 403, data: 'Debug functions are not supported' };
    }

    return runAgentProcess(agent, req);
}

async function runAgentProcess(agent: any, req: Request) {
    try {
        //extract endpoint path
        //live agents (dev) do not have a version number
        //deployed agents have a version number
        const pathMatches = req.path.match(/(^\/v[0-9]+\.[0-9]+?)?(\/api\/(.+)?)/);
        if (!pathMatches || !pathMatches[2]) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }
        const endpointPath = pathMatches[2];
        const input = req.method == 'GET' ? req.query : req.body;
        const result: any = await sreAdapter.run(agent.id, req);
        if (result.error) {
            console.error('ERROR', result.error);
            //res.status(500).json({ ...result, error: result.error.toString(), agentId: agent.id, agentName: agent.name });
            return { status: 500, data: { ...result, error: result.error.toString(), agentId: agent?.id, agentName: agent?.name } };
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
