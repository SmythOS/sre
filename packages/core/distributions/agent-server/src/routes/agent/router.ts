import express from 'express';
import AgentLoader from '../../middlewares/AgentLoader.mw';
import cors from '../../middlewares/cors.mw';
import agentAuth from '../../middlewares/agent-oauth.mw';
import { processAgentRequest } from '../../services/agent-request-handler';
import uploadHandler from '../../middlewares/uploadHandler.mw';
import ParallelRequestLimiter from '../../middlewares/ParallelRequestLimiter.mw';
import { sreAdapter } from '../../services/sre-adapter';

const router = express.Router();

/* AgentLoader must come before agentAuth because agentAuth relies on req._agent, set by AgentLoader.
Also, uploadHandler should precede AgentLoader to parse multipart/form-data correctly */
const middlewares = [cors, uploadHandler, AgentLoader, ParallelRequestLimiter, agentAuth];

router.options('*', [cors]); //enable CORS for preflight requests

router.post(`/api/*`, middlewares, async (req, res) => {
    const agent = req._agent;
    const result: any = await processAgentRequest(agent, req);
    // const result = await sreAdapter.debugRun(agent.id, req);
    return res.status(result?.status || 500).send(result?.data);
});
router.get(`/api/*`, middlewares, async (req, res) => {
    const agent: any = req._agent;
    const result: any = await processAgentRequest(agent, req);

    // const result = await sreAdapter.debugRun(agent.id, req);
    // return res.status(result?.status || 500).send(result?.data);
    return res.status(200).send(result);
});

router.post(`/:version/api/*`, middlewares, async (req, res) => {
    const agent: any = req._agent;
    const result: any = await processAgentRequest(agent, req);
    return res.status(result?.status || 500).send(result?.data);
});
router.get(`/:version/api/*`, middlewares, async (req, res) => {
    const agent: any = req._agent;
    const result: any = await processAgentRequest(agent, req);
    return res.status(result?.status || 500).send(result?.data);
});

router.post(/^\/v[0-9]+(\.[0-9]+)?\/api\/(.+)/, middlewares, async (req, res) => {
    const agent: any = req._agent;
    if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
    }
    //const parts = req.url.split('/');
    //const version = parts[1];
    //const endpoint = parts[3];

    const result: any = await processAgentRequest(agent, req);
    return res.status(result?.status || 500).send(result?.data);
    //res.send({ result: `Not implemented yet\nVersion: ${version}, Endpoint: ${endpoint}` });
});

// router.post(`/component/:name`, middlewares, async (req, res) => {
//     const { name } = req.params;
//     const component = Components[name];
//     if (!component) {
//         res.status(404).send('Component not found');
//         return;
//     }
//     const result = await component.process(req.body).catch((error) => ({ error }));
//     if (result.error) {
//         res.status(500).send(result);
//         return;
//     }
//     res.send(result);
// });

export default router;
