import { IAgent as Agent } from '@sre/types/Agent.types';
import { ForkedAgent } from '@sre/AgentManager/ForkedAgent.class';
import { Component } from './Component.class';
import Joi from 'joi';
import { delay } from '../utils';

interface AsyncResult {
    JobID: string;
    _debug?: string;
    [key: string]: any; // Allow additional properties from input in forked mode
}

interface AsyncErrorResult {
    _error: string;
    _debug: string;
}

export class Async extends Component {
    static JOBS = {};
    protected configSchema = null;
    static ForkedAgent;
    constructor() {
        super();
        // import('../ForkedAgent.class').then((ForkedAgent) => {
        //     Async.ForkedAgent = ForkedAgent.default;
        // });
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Async Log ===`);

        //we set data.forked to true in the forked component in order to refork it again.
        const forked = config.data.forked;
        let _error = null;

        try {
            //const runtimeData = agent.agentRuntime.getRuntimeData(config.id);

            if (!forked) {
                const forkedAgent: ForkedAgent = new ForkedAgent(agent, config.id);
                const JobID = forkedAgent.jobID;

                logger.debug(` JobID: ${JobID}`);

                forkedAgent.agent.async = true;
                forkedAgent.agent.jobID = JobID;
                //clean JobID branch
                this.cleanJobIDBranch(forkedAgent.agent);

                const componentData = forkedAgent.components[config.id];
                componentData.data.forked = true;

                forkedAgent.agentRequest.body = { ...input };

                if (!Async.JOBS[agent.id]) Async.JOBS[agent.id] = {};
                Async.JOBS[agent.id][JobID] = {
                    //forkedAgent,
                    status: 'pending',
                };

                //We use this to inform the debugger about the list of components used by this job
                //this is only used to provide a visual feedback in the debugger UI
                if (agent.debugSessionEnabled) {
                    const _job_components = Object.keys(forkedAgent.components);
                    agent.agentRuntime.updateComponent(config.id, { _job_components });
                }

                forkedAgent
                    .process(`/api/${config.id}`, input)
                    .then((result) => {
                        Async.JOBS[agent.id][JobID].result = result;
                        Async.JOBS[agent.id][JobID].status = 'done';
                    })
                    .finally(async () => {
                        if (Async.JOBS[agent.id][JobID].status !== 'done') {
                            Async.JOBS[agent.id][JobID].status = 'failed';
                        }
                        if (agent.debugSessionEnabled) {
                            await delay(1000); //wait for the debugger to update the UI
                            //ctxData in agentRuntime might have been updated by the main component
                            //we need to reload it in order to ensure that we're updating the latest version
                            agent.agentRuntime.reloadCtxData();
                            agent.agentRuntime.updateComponent(config.id, { _job_components: [] });
                        }
                    });

                logger.debug(''); // empty line
                const result: AsyncResult = {
                    JobID,
                    _debug: logger.output,
                };
                logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
                return result;
            } else {
                //const Input = input.Input;
                const result: AsyncResult = {
                    JobID: agent.jobID,
                };
                for (let key in input) {
                    result[key] = input[key];
                }

                logger.debug(` JobID: ${agent.jobID}`);

                logger.debug(''); // empty line
                result._debug = logger.output;
                logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
                return result;
            }
        } catch (error: any) {
            _error = error?.message || error?.toString() || error;
            logger.error(` Error: ${_error}`);
            const errorResult: AsyncErrorResult = {
                _error,
                _debug: logger.output,
            };
            return errorResult;
        }
    }

    // private recursiveTagAsyncComponents(component, agent: Agent) {
    //     for (let output of component.outputs) {
    //         if (component.name == 'Async' && output.name === 'JobID') continue; //'JobID' is a special output
    //         const connected = agent.connections.filter((c) => c.sourceId === component.id && c.sourceIndex === output.index);
    //         if (!connected) continue;
    //         for (let con of connected) {
    //             const targetComponent = agent.components[con.targetId];
    //             if (!targetComponent) continue;
    //             targetComponent.async = true;
    //             this.recursiveTagAsyncComponents(targetComponent, agent);
    //         }
    //     }
    // }
    // private tagAsyncComponents(agent: Agent) {
    //     const componentsList: any[] = Object.values(agent.components);
    //     const AsyncComponent = componentsList.find((c) => c.name === 'Async');
    //     if (!AsyncComponent) return;
    //     AsyncComponent.async = true;

    //     this.recursiveTagAsyncComponents(AsyncComponent, agent);
    // }
    private cleanJobIDBranch(agent: Agent) {
        //this.tagAsyncComponents(agent);

        const componentsList: any[] = Object.values(agent.components);
        const AsyncComponent = componentsList.find((c) => c.name === 'Async');
        //const endpointComponent = componentsList.find((c) => c.name === 'APIEndpoint');
        if (!AsyncComponent) return;
        const jobIDOutputIndex = AsyncComponent.outputs.findIndex((o) => o.name === 'JobID');
        if (jobIDOutputIndex === -1) return;
        //delete connections where sourceId = AsyncComponent.id and sourceOutputIndex = jobIDOutputIndex and the component is not tagged as async
        agent.connections = agent.connections.filter((c) => {
            const toDelete = c.sourceId === AsyncComponent.id && c.sourceIndex === jobIDOutputIndex && !agent.components[c.targetId].async;
            return !toDelete;
        });

        //TODO : remove orphaned branches
        this.removeOrphanedBranches(agent);
    }

    private removeOrphanedBranches(agent: Agent) {
        const toDelete: any[] = [];
        for (let componentId in agent.components) {
            const component = agent.components[componentId];
            if (component.name === 'APIEndpoint') continue;
            const connected = agent.connections.some((c) => c.targetId === component.id);
            if (!connected) {
                //this.removeComponent(agent, component.id);
                toDelete.push(component.id);
            }
        }
        for (let id of toDelete) {
            this.removeComponent(agent, id);
        }
    }

    private removeComponent(agent: Agent, componentId: string) {
        const component = agent.components[componentId];
        delete agent.components[componentId];

        //delete connections where sourceId = componentId
        agent.connections = agent.connections.filter((c) => c.sourceId !== componentId);
        this.removeOrphanedBranches(agent);
    }
}
