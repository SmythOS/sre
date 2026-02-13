import { Component } from '@sre/Components/Component.class';
import { Agent } from './Agent.class';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { LLMCache } from '@sre/MemoryManager/LLMCache';
import { RuntimeContext } from '@sre/MemoryManager/RuntimeContext';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { uid } from '@sre/utils';

const logger = Logger('AgentRuntime');
const AgentRuntimeUnavailable = new Proxy(
    {},
    {
        get: function (target, prop, receiver) {
            // Check if the property being accessed is a function
            if (typeof target[prop] === 'function') {
                return target[prop];
            } else {
                // Return a function that logs "unavailable"
                return function () {
                    logger.warn(`AgentRuntime Unavailable tried to call : ${prop.toString()}`);
                };
            }
        },
    },
);
export class AgentRuntime {
    private static processResults: any = {};
    private static tagsData = {};
    public static dummy = AgentRuntimeUnavailable;

    private agentContext: RuntimeContext;
    public llmCache: LLMCache;
    //private ctxFile: string = '';
    private xDebugRun: string | undefined = '';
    private xDebugInject: string | undefined = '';
    private xDebugRead: string | undefined = '';
    private xDebugStop: string | undefined = '';
    private xDebugPendingInject: any = null;
    private xMockDataInject: any = null;
    public xDebugId: string | undefined = '';

    private xDebugCmd: string | undefined = '';
    private _debugActive = false;
    private _runtimeFileReady = false;
    public sessionClosed = false;

    private reqTagOwner = false;

    //reqTag is used to identify the current running workflow including nested calls, it allows us to identify circular calls
    public reqTag: any;
    public processID: any; //this identifies the current processID, a process ID is the full set of runCycles that is executed by the agent.
    public workflowReqId: any; //this identifies the current running workflow. a workflow starts when and agent endpoint is called, or a debug session is initiated, and ends when no more steps can be executed.

    public alwaysActiveComponents: any = {};
    public exclusiveComponents: any = {};

    private checkRuntimeContext: any = null;

    public get circularLimitReached() {
        return this.agentContext?.circularLimitReached || false;
    }
    public set circularLimitReached(value) {
        if (this.agentContext) this.agentContext.circularLimitReached = value;
    }

    public get debug() {
        return this._debugActive;
    }
    public get curStep() {
        return this.agentContext?.step || 0;
    }

    constructor(public agent: Agent) {
        this.reqTag = agent.agentRequest.header('X-REQUEST-TAG');
        const isNestedProcess: boolean = !!this.reqTag;

        if (!this.reqTag) {
            //tagged request should not be run in debug mode, this comes from a parent agent
            this.xDebugStop = agent.agentRequest.header('X-DEBUG-STOP');
            this.xDebugRun = agent.agentRequest.header('X-DEBUG-RUN'); //send this as header to create a session and attach it
            this.xDebugInject = agent.agentRequest.header('X-DEBUG-INJ');
            this.xDebugRead = agent.agentRequest.header('X-DEBUG-READ');
            this.reqTag = 'xTAG-' + uid(); //if request tag is not set, set a new value, this will be used to tag nested agent calls
            this.reqTagOwner = true;
        } else {
            this.xDebugStop = undefined;
            this.xDebugRun = undefined;
            this.xDebugInject = undefined;
            this.xDebugRead = undefined;
        }

        this.agent.conversationId = agent.agentRequest.header('X-CONVERSATION-ID');
        this.xDebugId = this.xDebugStop || this.xDebugRun || this.xDebugRead;

        //if (req.body) {
        if (!this.xDebugId && agent.agentRequest.body) {
            if (this.xDebugInject != undefined && this.xDebugInject != null) {
                this.xDebugPendingInject = agent.agentRequest.body;
                this.xDebugRun = this.xDebugInject || 'inj-' + uid();
            } else {
                if (this.xDebugRun == '') {
                    this.xDebugRun = 'dbg-' + uid(); //generate a random debug id
                }
            }
            this.xDebugId = this.xDebugRun;
        }

        if (agent.agentRequest.header('X-MOCK-DATA-INJ') !== undefined) {
            this.xMockDataInject = agent.agentRequest.body;
        }

        this.processID = this.xDebugId;

        if (!this.xDebugId) {
            //if it's not a debug session, processID is unique per request
            this.xDebugId = agent.sessionId;
            this.processID = this.reqTag;
        }
        if (isNestedProcess) {
            // Need to make processID unique to run same sub-agents multiple times in parallel
            this.processID += `:${Math.floor(1000 + Math.random() * 9000)}`;
        }

        //we need a way to identify current running workflow in a unique way
        //=> In debug mode, xDebugRun holds the debug sessionID which is unique per workflow run
        //   if the debug session is stopped, xDebugStop holds the sessionID
        //   Note : We can't use reqTag in debug mode because it changes every time a new debug step is executed
        //
        //=> In normal mode, reqTag is unique per workflow run
        this.workflowReqId = this.xDebugRun || this.xDebugStop || this.reqTag;

        //tagsData can be updated from external integrations (eg. Chatbot, API Endpoint, etc.)
        if (!AgentRuntime.tagsData[this.reqTag]) AgentRuntime.tagsData[this.reqTag] = {};
        if (!AgentRuntime.processResults[this.processID])
            AgentRuntime.processResults[this.processID] = {
                timestamp: Date.now(),
                errorResults: [],
                sessionResults: [],
            };

        this.agentContext = new RuntimeContext(this);
        this.agentContext.on('ready', () => {
            let method = (agent.agentRequest.method || 'POST').toUpperCase();
            const endpoint = agent.endpoints?.[agent.agentRequest.path]?.[method];
            const trigger = agent.triggers?.[agent.agentRequest.path];
            const endpointDBGCall = this.xDebugId?.startsWith('dbg-');

            this.alwaysActiveComponents = {};
            this.exclusiveComponents = {};
            for (let component of this.agent.data.components) {
                const cpt: Component = this.agent.ComponentInstances[component.name];
                if (!cpt) {
                    logger.warn(`Component ${component.name} Exists in agent but has no implementation`, AccessCandidate.agent(this.agent.id));
                    continue;
                }

                if (trigger && trigger.id != undefined && component.id == trigger.id && this.xDebugId?.startsWith('dbg-')) {
                    this.updateComponent(component.id, { active: true });
                }

                //if this debug session was initiated from an endpoint, we mark the endpoint component as active
                if (endpoint && endpoint.id != undefined && component.id == endpoint.id && endpointDBGCall) {
                    this.updateComponent(component.id, { active: true });
                }

                if (cpt.alwaysActive) {
                    this.alwaysActiveComponents[component.id] = cpt;
                    this.updateComponent(component.id, { active: true, alwaysActive: true });
                    const runtimeData = { ...this.getRuntimeData(component.id) };
                    this.saveRuntimeComponentData(component.id, runtimeData);
                }
                if (cpt.exclusive) {
                    this.exclusiveComponents[component.id] = cpt;
                    this.updateComponent(component.id, { exclusive: true });
                    const runtimeData = { ...this.getRuntimeData(component.id) };
                    this.saveRuntimeComponentData(component.id, runtimeData);
                }
            }
        });

        //if xDebugId is equal to agent session, it means that the debugging features are not active
        this._debugActive = this.xDebugId != agent.sessionId;

        this.initLLMCache();
    }

    private getDebugConversationKey(): string {
        return `debug:${this.xDebugId}:conversationId`;
    }

    private async initLLMCache() {
        const xCacheId = this.agent.agentRequest.header('X-CACHE-ID') || '';
        let conversationId = this.agent.conversationId;

        /**
         * Retrieve conversationId for workflow runtime using debug session mapping.
         *
         * Goal: Track conversation context across different runtime instances (chatbot conversation vs workflow components).
         *
         * When debugging chatbot:
         * - Chatbot conversation runtime HAS conversationId (from chat request)
         * - Workflow/debugger runtime DOES NOT have conversationId (workflow execution)
         *
         * Solution: Retrieve conversationId using xDebugId from the mapping stored by chatbot runtime.
         */
        if (!conversationId && this._debugActive && this.xDebugId) {
            const cacheConnector = ConnectorService.getCacheConnector();
            const storedConversationId = await cacheConnector
                .requester(AccessCandidate.agent(this.agent.id))
                .get(this.getDebugConversationKey())
                .catch(() => null);

            if (storedConversationId) {
                conversationId = storedConversationId;
                this.agent.conversationId = storedConversationId;
            }
        }

        /**
         * Generate cache ID to track conversation context across different runtime instances.
         *
         * Priority: xCacheId (explicit override) > conversationId (for context tracking) > undefined
         *
         * Why conversationId is needed:
         * - Enables GenAILLM's "Use Context Window" to maintain conversation history
         * - When debugging chatbot: conversationId available from chatbot runtime, OR retrieved via
         *   debug mapping (above) for workflow runtime - both use same cache ID to share context.
         */
        const cacheId = xCacheId || (conversationId ? LLMCache.generateLLMCacheId(conversationId) : undefined);
        this.llmCache = new LLMCache(AccessCandidate.agent(this.agent.id), cacheId);

        /**
         * Store conversationId with debug session for workflow runtime to retrieve.
         *
         * When debugging chatbot:
         * - Chatbot runtime HAS conversationId → stores mapping via getDebugConversationKey()
         * - Workflow runtime retrieves conversationId using xDebugId → both share same LLM context cache
         *
         * TTL: 1 hour (sufficient for typical debug workflows)
         */
        if (this._debugActive && this.xDebugId && this.agent.conversationId) {
            const cacheConnector = ConnectorService.getCacheConnector();
            const DEBUG_SESSION_TTL = 60 * 60; // 1 hour in seconds

            cacheConnector
                .requester(AccessCandidate.agent(this.agent.id))
                .set(this.getDebugConversationKey(), this.agent.conversationId, null, null, DEBUG_SESSION_TTL)
                .catch((err) => {
                    logger.warn('Failed to store debug-conversation mapping', err);
                });
        }
    }

    public async ready() {
        return this.agentContext.ready();
    }

    /**
     * Retrieves the conversation ID associated with the current debug session
     * @returns The conversation ID if found, undefined otherwise
     */
    public async getConversationId(): Promise<string | undefined> {
        if (this.agent.conversationId) {
            return this.agent.conversationId;
        }

        if (this._debugActive && this.xDebugId) {
            const conversationId = await this.llmCache.get(this.getDebugConversationKey(), 'text');
            return conversationId || undefined;
        }

        return undefined;
    }

    public destroy() {
        this.sessionClosed = true;
        this.sync();
    }

    public incTag(componentId) {
        if (!AgentRuntime.tagsData[this.reqTag][componentId]) AgentRuntime.tagsData[this.reqTag][componentId] = 0;
        AgentRuntime.tagsData[this.reqTag][componentId]++;

        // console.log(
        //     `incTag agentId=${this.agent.id} componentId=${componentId} tag=${this.reqTag} ==> ${AgentRuntime.tagsData[this.reqTag][componentId]}`,
        // );
        //console.log('incTag tagsData', tagsData);
    }

    public async sync() {
        //if (!this.ctxFile) return;

        const deleteTag = (this.reqTagOwner && this.sessionClosed) || this.circularLimitReached;
        if (deleteTag) {
            delete AgentRuntime.tagsData[this.reqTag];
        }

        this.agentContext.enqueueSync();
    }
    public getWaitingComponents() {
        const ctxData = this.agentContext;
        const dbgComponents: any = Object.values(ctxData?.components || []).filter((c: any) => c?.ctx?.active == true);
        const waitingComponents: any = dbgComponents.filter((c: any) => c?.ctx?.status && typeof c?.ctx?.output !== undefined);
        return waitingComponents;
    }
    public getExclusiveActiveComponents() {
        const ctxData = this.agentContext;
        const dbgComponents: any = Object.values(ctxData?.components || []).filter((c: any) => c?.ctx?.active == true);
        const exclusiveActiveComponents: any = dbgComponents.filter((c: any) => c?.ctx?.exclusive == true);
        return exclusiveActiveComponents;
    }
    public readState(stateId: string, deltaOnly = false) {
        //if (!this._debugActive || !this.xDebugRead) return null;
        if (!this._debugActive || !stateId) return null;

        //this.checkRuntimeContext();
        const runtime = this;
        const agent = this.agent;

        const ctxData = runtime.agentContext;
        const dbgAllComponents: any = runtime.xDebugPendingInject || Object.values(ctxData?.components || []);

        //first try to find exclusive active components
        let dbgActiveComponents: any;
        dbgActiveComponents = dbgAllComponents.filter((c: any) => c?.ctx?.active == true && c?.ctx?.exclusive == true);
        //if no exclusive active components, find all active components
        if (!dbgActiveComponents || dbgActiveComponents.length == 0)
            dbgActiveComponents = dbgAllComponents.filter(
                (c: any) =>
                    c?.ctx?.active == true ||
                    (!c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0),
            );
        //find waiting components that was not previously run
        const dbgActiveWaitingComponents: any = dbgAllComponents.filter(
            (c: any) => c?.ctx?.active == true && c?.ctx?.status && typeof c?.ctx?.output !== undefined,
        );

        const dbgActiveReadyComponents: any = dbgAllComponents.filter((c: any) => c?.ctx?.active == true && !c?.ctx?.status);

        let state = {};
        for (let dbgComponent of dbgAllComponents) {
            state[dbgComponent.id] = dbgComponent.ctx;
        }

        //let dbgSession: any = runtime.xDebugRead;
        let dbgSession: any = stateId;

        // let alwaysActiveComponents = 0;
        // for (let activeCpt of dbgActiveComponents) {
        //     if (this.agent.alwaysActiveComponents[activeCpt.id]) alwaysActiveComponents++;
        // }

        if (!dbgActiveComponents || dbgActiveComponents.length == 0 /*|| dbgActiveComponents.length == alwaysActiveComponents*/) {
            dbgSession = null;
            runtime.sessionClosed = true;
        }

        const remainingActiveComponents: any = Object.values(ctxData?.components || []).filter(
            (c: any) => c?.ctx?.active == true && !c?.ctx?.alwaysActive,
        );
        const activeAsyncComponents: any = Object.values(ctxData?.components || []).filter(
            (c: any) => !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0,
        );

        if (remainingActiveComponents.length == 0 && activeAsyncComponents.length == 0 /*&& awaitingInputs.length == 0*/) {
            runtime.sessionClosed = true;
        }

        if (runtime.circularLimitReached) {
            const circularLimitData = runtime.checkCircularLimit();
            const error = `Circular Calls Limit Reached on ${circularLimitData}. Current agent circular limit is ${agent.circularLimit}`;
            runtime.sessionClosed = true;
            return { state, dbgSession, sessionClosed: runtime.sessionClosed, error };
        }

        const step = this.curStep >= 1 ? this.curStep - 1 : 0; //current state was executed in previous step

        if (deltaOnly) {
            const delta = {};
            for (let cptId in state) {
                const cpt = state[cptId];

                //workaround, here we are supposed to test component steps that are equalt to current step
                //but due to an inconsistency, the Async component has sometimes a step greater than the current step
                if (cpt.step >= step) delta[cptId] = cpt;
                //FIXME : identify the root cause of this issue and replace >= with ==
            }
            //return { state: delta, dbgSession, sessionClosed: runtime.sessionClosed, step };
            state = delta;
        }

        return { state, dbgSession, sessionClosed: runtime.sessionClosed, step };
    }

    /**
     * This method is called by the agent to run a process cycle, it will run all active components and return the results
     * The function is called multiple times until all components are executed and no more active components are available
     * @returns
     */
    public async runCycle() {
        logger.debug(
            `runCycle agentId=${this.agent.id} wfReqId=${this.workflowReqId}  reqTag=${this.reqTag} session=${this.xDebugRun} cycleId=${this.processID}`,
            AccessCandidate.agent(this.agent.id),
        );
        //this.checkRuntimeContext();

        const runtime = this;
        const agent = this.agent;
        const ctxData = runtime.agentContext;
        const dbgAllComponents: any = runtime.xDebugPendingInject || Object.values(ctxData?.components || []);

        //first try to find exclusive active components
        let dbgActiveComponents: any;
        dbgActiveComponents = dbgAllComponents.filter((c: any) => c?.ctx?.active == true && c?.ctx?.exclusive == true);
        //if no exclusive active components, find all active components
        if (!dbgActiveComponents || dbgActiveComponents.length == 0)
            dbgActiveComponents = dbgAllComponents.filter(
                (c: any) =>
                    c?.ctx?.active == true ||
                    (!c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0),
            );
        //find waiting components that was not previously run
        const dbgActiveWaitingComponents: any = dbgAllComponents.filter(
            (c: any) => c?.ctx?.active == true && c?.ctx?.status && typeof c?.ctx?.output !== undefined,
        );
        const dbgActiveReadyComponents: any = dbgAllComponents.filter(
            (c: any) =>
                (c?.ctx?.active == true && !c?.ctx?.status) ||
                (!c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0),
        );
        //const dbgActiveReadyComponents: any = dbgActiveComponents.filter((c: any) => c?.ctx?.active == true && !c?.ctx?.status);

        let step: any;

        if (!dbgActiveComponents || dbgActiveComponents.length == 0) {
            runtime.sessionClosed = true;
            step = {
                state: { sessionClosed: true },
                dbgSession: null,
                //expiredDbgSession: runtime.xDebugRun || runtime.xDebugStop,
                expiredDbgSession: runtime.xDebugId,
                sessionClosed: true,
            };
        }

        if (!step && dbgActiveComponents.length == dbgActiveWaitingComponents.length && ctxData.sessionResult) {
            runtime.sessionClosed = true;
            step = {
                state: { sessionClosed: true },
                dbgSession: null,
                //expiredDbgSession: runtime.xDebugRun,
                expiredDbgSession: runtime.xDebugId,
                sessionClosed: true,
            };
        }
        if (!step && dbgActiveReadyComponents.length > 0) {
            const promises: any = [];

            for (let dbgComponent of dbgActiveReadyComponents) {
                const injectInput = runtime.xDebugPendingInject ? dbgComponent.ctx.input : undefined;

                promises.push(agent.callComponent(dbgComponent.ctx.sourceId, dbgComponent.id, injectInput));
            }
            const dbgResults = await Promise.all(promises);
            const state = dbgResults.length == 1 ? dbgResults[0] : dbgResults;

            runtime.xDebugPendingInject = null;

            const remainingActiveComponents: any = Object.values(ctxData?.components || []).filter((c: any) => c?.ctx?.active == true);
            const activeAsyncComponents: any = Object.values(ctxData?.components || []).filter(
                (c: any) => !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0,
            );
            const dbgActiveWaitingComponents: any = dbgAllComponents.filter((c: any) => c?.ctx?.status && typeof c?.ctx?.output !== undefined);

            if (dbgActiveWaitingComponents.length == remainingActiveComponents.length) {
                ctxData.sessionResult = true;
            }

            //capture triggers results

            const triggers = Object.values(agent.triggers);
            let triggersResults = dbgResults.flat().filter(
                (e) =>
                    e.id &&
                    e.result &&
                    !e.result._missing_inputs &&
                    !e.result._in_progress &&
                    //check if the current result is a trigger
                    triggers.find((t: any) => t.id == e.id),
            );

            //capture workflow results
            let sessionResults = dbgResults.flat().filter(
                (e) =>
                    e.id &&
                    e.result &&
                    !e.result._missing_inputs &&
                    //check if this is the last component in the chain
                    !agent.connections.find((c) => c.sourceId == e.id),
            );

            sessionResults = sessionResults.concat(triggersResults);

            let errorResults = dbgResults.flat().filter((e) => e.id && (e.error || e.result?._error));

            //also filter out erroneous components that are children of a loop
            //otherwise, errors inside a loop will be reported as session results and can lead to wrong results or generated noise in the final agent output
            errorResults = errorResults.filter((e) => {
                return !ctxData?.components?.[e.id]?.ctx?.runtimeData?._ChildLoopData;
            });

            if (ctxData.sessionResult && sessionResults.length == 0 && runtime.sessionClosed) {
                //no result ? check if we have errors
                sessionResults = errorResults;
            }

            ctxData.sessionResults = sessionResults;
            step = {
                state,
                dbgSession: runtime.xDebugRun,
                sessionResult: runtime.agentContext.sessionResult,
                sessionResults: runtime.agentContext.sessionResults,
                errorResults,
                sessionClosed: remainingActiveComponents.length == 0 && activeAsyncComponents.length == 0 /*&& awaitingInputs.length == 0*/,
            };
        } else {
            runtime.sessionClosed = true;
            //return { sessionClosed: true };
            step = {
                state: { sessionClosed: true },
                dbgSession: null,
                //expiredDbgSession: runtime.xDebugRun || runtime.xDebugStop,
                expiredDbgSession: runtime.xDebugId,
                sessionClosed: true,
            };
        }

        this.checkCircularLimit();
        if (step.sessionResults) {
            AgentRuntime.processResults[this.processID].sessionResults.push(step.sessionResults);
        }
        if (step.errorResults) {
            AgentRuntime.processResults[this.processID].errorResults.push(step.errorResults);
        }

        if (step?.sessionClosed || this.circularLimitReached) {
            const finalResult = this.processResults();
            step.finalResult = finalResult;
            runtime.sessionClosed = true;
        }

        this.incStep();
        this.sync();
        return step;
    }

    private processResults() {
        //this.checkCircularLimit();
        let result: any = { error: 'Error processing results' };
        const sessionResults = AgentRuntime.processResults[this.processID].sessionResults;
        const errorResults = AgentRuntime.processResults[this.processID].errorResults;
        if (this.circularLimitReached) {
            const circularLimitData = this.circularLimitReached;
            result = { error: `Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.agent.circularLimit}` };
        } else {
            let _state = [sessionResults, errorResults].flat(Infinity);
            if (!_state || _state.length == 0) _state = errorResults.flat(Infinity);

            //post process run cycle results
            //deduplicating redundant entries

            const _data = _state
                .reduce(
                    (acc, current) => {
                        if (!acc.seen[current.id]) {
                            acc.result.push(current);
                            acc.seen[current.id] = true;
                        }
                        return acc;
                    },
                    { seen: {}, result: [] },
                )
                .result.filter((e) => !e.result?._exclude);

            //data.forEach((d: any) => delete d?.result?._debug);

            result = _data;
            /////////////
        }

        //cleanup
        delete AgentRuntime.processResults[this.processID];

        this.sync();
        return result;
    }

    public checkCircularLimit() {
        if (this.circularLimitReached) return this.agentContext.circularLimitReached;
        for (let componentId in AgentRuntime.tagsData[this.reqTag]) {
            if (AgentRuntime.tagsData[this.reqTag][componentId] > this.agent.circularLimit) {
                this.sessionClosed = true;
                this.agentContext.circularLimitReached = componentId;
                return componentId;
            }
        }
        return false;
    }

    public async injectDebugOutput(componentId: string) {
        let component: {
            ctx?: Record<string, any>;
        } = {};

        if (this.xDebugPendingInject) {
            component = this.xDebugPendingInject?.find((c: any) => c.id == componentId);
        } else if (this.xMockDataInject) {
            component = this.xMockDataInject?.find((c: any) => c.id == componentId);
        }

        if (component?.ctx?.output) {
            //if all outputs values are empty, we don't inject
            let allEmpty = true;
            for (let key in component.ctx.output) {
                if (component.ctx.output[key] != '') {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) return null;

            return component.ctx.output;
        }
    }
    public getRuntimeData(componentId) {
        const componentData = this.getComponentData(componentId);
        if (!componentData) return {};
        const rData = componentData.runtimeData || {};

        return rData;
    }
    public updateRuntimeData(componentId, data) {
        const componentData = this.getComponentData(componentId);
        if (!componentData) return;
        componentData.runtimeData = { ...componentData.runtimeData, ...data };

        this.sync();
    }

    public saveRuntimeComponentData(componentId, data) {
        this.updateComponent(componentId, { runtimeData: data });
    }

    public incStep() {
        this.agentContext.incStep();
    }
    public updateComponent(componentId: string, data: any) {
        this.agentContext.updateComponent(componentId, data);
    }

    public resetComponent(componentId: string) {
        this.agentContext.resetComponent(componentId);
    }

    public getComponentData(componentId: string) {
        return this.agentContext.getComponentData(componentId);
    }
}
