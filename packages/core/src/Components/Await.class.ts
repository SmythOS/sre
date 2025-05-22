import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from './Component.class';
import axios from 'axios';
import Joi from 'joi';
import Async from './Async.class';

export class Await extends Component {
    static WAITS = {};

    protected configSchema = Joi.object({
        jobs_count: Joi.number().min(1).max(100).default(1).label('Jobs Count'),
        max_time: Joi.number().min(1).max(21600).default(1).label('Max time'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            let Results: any = {};
            const _error = null;
            let jobs_count = parseInt(config.data.jobs_count || 1);
            let max_time = parseInt(config.data.max_time || 1);

            const jobs = Array.isArray(input.Jobs) ? input.Jobs : [input.Jobs];

            if (!Await.WAITS[agent.id]) Await.WAITS[agent.id] = {};
            if (!Await.WAITS[agent.id][config.id]) Await.WAITS[agent.id][config.id] = {};
            if (!Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId])
                Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId] = [];

            //add jobs to the list
            for (let jobID of jobs) Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId].push(jobID);

            logger.debug('Jobs', jobs);
            logger.debug('Waiting for jobs to finish');

            let promise = new Promise((resolve, reject) => {
                let interval = setInterval(() => {
                    if (max_time < 0) {
                        clearInterval(interval);
                        return resolve(true);
                    }
                    let done = true;
                    let completed = 0;
                    for (let jobID of jobs) {
                        if (Async.JOBS?.[agent.id]?.[jobID]?.status == 'pending') {
                            done = false;
                            break;
                        } else {
                            completed++;
                        }
                    }
                    if (completed >= jobs_count) {
                        done = true;
                    }

                    if (done) {
                        clearInterval(interval);
                        return resolve(true);
                    }

                    max_time -= 1;
                }, 1000);
            });

            await promise;
            logger.debug('Jobs finished, collecting results');
            for (let jobID of jobs) {
                Results[jobID] = {
                    output: Async.JOBS?.[agent.id]?.[jobID]?.result,
                    status: Async.JOBS?.[agent.id]?.[jobID]?.status || 'unknown_job',
                };
            }
            delete Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId];

            logger.debug('Results', Results);
            return { Results, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error running code \n${_error}\n`);
            delete Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId];

            return { Output: undefined, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        }
    }
}

export default Await;
