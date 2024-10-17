import dotenv from 'dotenv';
dotenv.config();
process.env.LOG_LEVEL = 'none';

import { AgentProcess, ConnectorService } from '../../../../src/index.ts';

export class SREAdapter {
    async run(agentId: string, req: any) {
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const data = await agentDataConnector.getAgentData(agentId);

        // setTimeout(() => {
        //     console.log('============ Debug Off ============');
        //     config.env.LOG_LEVEL = 'none';
        // }, 1000);

        const result = await AgentProcess.load(data).run({
            ...req,
            path: req.url,
            url: undefined,
            // headers: {
            //     ...req.headers,
            //     'X-DEBUG-RUN': '',
            // },
        });

        console.log('>>>>>>>>>>>>>>>>> Result \n', JSON.stringify(result, null, 2));

        return result;
    }

    async debugRead() {}
}

export const sreAdapter = new SREAdapter();
