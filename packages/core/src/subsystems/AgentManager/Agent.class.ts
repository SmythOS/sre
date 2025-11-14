import { Component } from '@sre/Components/Component.class';
import { ControlledPromise, delay, getCurrentFormattedDate, uid } from '@sre/utils/index';
import { AgentLogger } from './AgentLogger.class';
import { AgentRequest } from './AgentRequest.class';
import { AgentRuntime } from './AgentRuntime.class';
import { AgentSettings } from './AgentSettings.class';
import { OSResourceMonitor } from './OSResourceMonitor';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { hookAsync } from '@sre/Core/HookService';
import { Logger } from '@sre/helpers/Log.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { IModelsProviderRequest, ModelsProviderConnector } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { Trigger } from '@sre/Components/Triggers/Trigger.class';
import { IAgent } from '@sre/types/Agent.types';
import { AgentSSE } from './AgentSSE.class';

const console = Logger('Agent');
const idPromise = (id) => id;
const MAX_LATENCY = 50;

export class Agent implements IAgent {
    public name: any;
    public data: any;
    public teamId: any;
    public components: any;
    public connections: any;
    public endpoints: any = {};
    public triggers: any = {};
    public sessionId;
    public sessionTag = '';
    public callerSessionId;
    public apiBasePath = '/api';
    public triggerBasePath = '/trigger';
    public agentRuntime: AgentRuntime | any;

    public usingTestDomain = false;
    public domain = '';
    public debugSessionEnabled = false;
    public circularLimit = 100; //TODO : make it configurable from agent settings
    public version = '';

    //public baseUrl = '';
    public agentVariables: any = {};
    private _killReason = '';
    //public agentRequest: Request | AgentRequest | any;
    public async = false;
    public jobID = '';
    public planInfo: any = {};
    public callback: (data: any) => void;

    public agentRequest: AgentRequest;
    public sse: AgentSSE;
    public modelsProvider: IModelsProviderRequest;

    private _componentInstance = {};

    public get ComponentInstances() {
        return this._componentInstance;
    }

    private _componentInstancesLoader = new ControlledPromise(() => {});

    constructor(
        public id,
        agentData,
        public agentSettings: AgentSettings,
        agentRequest?: AgentRequest | any //private req: express.Request,
    ) {
        //this.agentRequest = new AgentRequest(req);
        const json = typeof agentData === 'string' ? JSON.parse(agentData) : agentData;
        this.data = json.connections && json.components ? json : json.data;
        if (!this.data) this.data = { name: '', connections: [], components: [] };
        //this.agentVariables = json.data.variables || {};

        this.name = this.data.name;
        this.version = this.data.agentVersion || ''; //when version is not set we load the latest dev version
        this.teamId = this.data.teamId;
        this.connections = this.data.connections;
        this.debugSessionEnabled = this.data.debugSessionEnabled;
        this.usingTestDomain = this.data.usingTestDomain;

        this.agentVariables = this.data.variables || {};

        const endpoints = this.data.components.filter((c) => c.name == 'APIEndpoint');
        for (let endpoint of endpoints) {
            let method = endpoint.data.method || 'POST';
            method = method.toUpperCase();
            if (!this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`])
                this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`] = {};
            this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`][method] = endpoint;
        }

        const triggers = this.data.components.filter((c) => typeof c.data?.triggerEndpoint == 'string');
        for (let trigger of triggers) {
            this.triggers[`${this.triggerBasePath}/${trigger.data.triggerEndpoint}`] = trigger;
        }

        this.components = {};
        for (let component of this.data.components) {
            //FIXME : this does not persist in debug mode, it breaks key value mem logic

            this.components[component.id] = component;
        }

        for (let connection of this.data.connections) {
            const sourceComponent = this.components[connection.sourceId];
            const targetComponent = this.components[connection.targetId];

            //if connections ids passed as names, we convert them to indexes
            //TODO : harmonize connections formats
            const sourceIndex =
                typeof connection.sourceIndex === 'number'
                    ? connection.sourceIndex
                    : sourceComponent.outputs.findIndex((o) => o.name == connection.sourceIndex);
            const targetIndex =
                typeof connection.targetIndex === 'number'
                    ? connection.targetIndex
                    : targetComponent.inputs.findIndex((i) => i.name == connection.targetIndex);

            connection.sourceIndex = sourceIndex;
            connection.targetIndex = targetIndex;

            const output = sourceComponent.outputs[sourceIndex];
            output.index = sourceIndex; // legacy ids (numbers)

            if (!output.next) output.next = [];
            output.next.push(targetComponent.id);

            //when a trigger is connected to an APIEndpoint it does not use the standard inputs
            //the targetIndex is then -1 and the input does not really exist
            //in that case, we should consider the trigger as an ancestor for all APIEndpoint inputs

            if (targetIndex >= 0) {
                const input = targetComponent.inputs[targetIndex];
                if (input) {
                    input.index = targetIndex;
                    if (!input.prev) input.prev = [];
                    input.prev.push(sourceComponent.id);
                }
            } else {
                //if the targetIndex is -1, we should consider the trigger as an ancestor for all APIEndpoint inputs
                for (let input of targetComponent.inputs) {
                    if (!input.prev) input.prev = [];
                    input.prev.push(sourceComponent.id);
                }
            }
        }

        this.tagAsyncComponents();

        if (agentRequest) {
            this.setRequest(agentRequest);
        }

        this.sse = new AgentSSE(this);
        //this.settings = new AgentSettings(this.id);

        try {
            //add hosted components to the available instances
            //hosted components are custom components that are specific to some SRE instances implementations : e.g Shell component is only available to local SRE
            const componentConnector = ConnectorService.getComponentConnector();
            componentConnector
                .requester(AccessCandidate.agent(id))
                .getAll()
                .then((customComponents) => {
                    this._componentInstance = { ...this._componentInstance, ...customComponents };
                    this._componentInstancesLoader.resolve(true);
                });
        } catch (error) {
            console.warn('Could not load custom components', AccessCandidate.agent(this.id));
            this._componentInstancesLoader.reject('Could not load custom components');
        }

        const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();
        if (modelsProvider.valid) {
            this.modelsProvider = modelsProvider.agent(id);
        }
    }

    /**
     * Add a SSE connection to the agent
     * @param sseSource - The SSE source to add
     * @param monitorId - The monitor ID to add
     */
    public addSSE(sseSource: Response | AgentSSE, monitorId?: string) {
        if (sseSource instanceof AgentSSE) {
            for (const [monitorId, res] of sseSource) {
                this.sse.add(res, monitorId); // add each connection to the new sse
            }
        } else {
            const id = monitorId || Math.random().toString(36).substring(2, 15);
            this.sse.add(sseSource, id);
        }
    }
    public setRequest(agentRequest: AgentRequest | any) {
        if (this.agentRequest) return;
        this.agentRequest = agentRequest;
        this.agentRequest = agentRequest;
        const dateTime = getCurrentFormattedDate();
        this.sessionId = 'rt-' + (this.agentRequest.sessionID || dateTime + '.' + uid());

        const sessionTags = this?.agentRequest?.headers['x-session-tag'];
        if (sessionTags) this.sessionTag += this.sessionTag ? `,${sessionTags}` : sessionTags;

        var regex = new RegExp(`^\/v[0-9]+(\.[0-9]+)?(${this.apiBasePath}|${this.triggerBasePath})\/(.*)`);
        if (
            this.agentRequest?.path?.startsWith(`${this.apiBasePath}/`) ||
            this.agentRequest?.path?.startsWith(`${this.triggerBasePath}/`) ||
            this.agentRequest?.path?.match(regex)
        ) {
            //we only need runtime context for API calls
            this.agentRuntime = new AgentRuntime(this);
            this.callerSessionId =
                this?.agentRequest?.headers['x-caller-session-id']?.substring(0, 256) || this.agentRuntime.workflowReqId || this.sessionId;
        } else {
            this.agentRuntime = AgentRuntime.dummy;
        }
    }
    public setCallback(callback: (data: any) => void) {
        this.callback = callback;
    }

    public kill(reason: string = 'kill') {
        this._killReason = reason;
    }
    public isKilled() {
        return !!this._killReason;
    }
    private async parseVariables() {
        //parse vault agent variables
        if (typeof this.agentVariables === 'object') {
            for (let key in this.agentVariables) {
                const value = this.agentVariables[key];
                if (value.startsWith('{{') && value.endsWith('}}')) {
                    //this.agentVariables[key] = (await parseKey(value, this.teamId)) || '';
                    this.agentVariables[key] = await TemplateString(value).parseTeamKeysAsync(this.teamId).asyncResult;
                }
            }
        }
    }

    @hookAsync('SREAgent.process')
    async process(endpointPath, input) {
        await this.agentRuntime.ready();

        //TODO: replace endpointPath + input params with a single agentRequest object. (This will require intensive regression testing)
        let result: any;
        let dbgSession: any = null;
        let sessionClosed = false;

        const eventId = 'e-' + uid();
        const startTime = Date.now();

        this.sse.send('agent', {
            eventId,
            action: 'callStart',
            endpointPath,
            id: this.id,
            name: this.name,
            startTime,
            input,
        });
        //this.agentRuntime.checkRuntimeContext();
        //insert log
        const logId = AgentLogger.log(this, null, {
            sourceId: endpointPath,
            componentId: `AGENT`,
            domain: this.domain,
            input,
            workflowID: this.agentRuntime.workflowReqId,
            processID: this.agentRuntime.processID,
            inputTimestamp: new Date().toISOString(),
            sessionID: this.callerSessionId,
            tags: this.sessionTag,
        });

        const method = this.agentRequest.method.toUpperCase();
        const endpoint = this.endpoints[endpointPath]?.[method] || this.triggers[endpointPath];

        //first check if this is a debug session, and return debug result if it's the case
        if (this.agentRuntime.debug) {
            if (!endpoint && this.agentRequest.path != '/api/') {
                if (logId) AgentLogger.log(this, logId, { error: `Endpoint ${method} ${endpointPath} Not Found` });

                throw new Error(`Endpoint ${method} ${endpointPath} Not Found`);
            }
            let dbgResult: any;
            //let dbgResult: any = await this.agentRuntime.readState(true); //is this a debug read reqeust ?

            if (!dbgResult) dbgResult = await this.agentRuntime.runCycle(); //no, is this a step over request ?

            // result = dbgResult?.state;
            // dbgSession = dbgResult?.dbgSession;
            // sessionClosed = dbgResult?.sessionClosed;
            if (dbgResult && typeof dbgResult?.state !== 'undefined') {
                this.agentRuntime.sync();
                if (dbgResult?.finalResult) {
                    dbgResult.finalResult = await this.postProcess(dbgResult.finalResult).catch((error) => ({ error }));
                }
                return dbgResult;
            }
        }

        if (!endpoint) {
            if (logId) AgentLogger.log(this, logId, { error: `Endpoint ${method} ${endpointPath} Not Found` });
            const endTime = Date.now();
            const duration = endTime - startTime;
            this.sse.send('agent', {
                eventId,
                action: 'callStop',
                endpointPath,
                id: this.id,
                name: this.name,
                startTime,
                endTime,
                duration,
                input,
                error: `Endpoint ${method} ${endpointPath} Not Found`,
            });
            throw new Error(`Endpoint ${method} ${endpointPath} Not Found`);
        }

        this.agentRuntime.updateComponent(endpoint.id, { active: true, input, sourceId: null });

        let step;
        do {
            step = await this.agentRuntime.runCycle();

            //adjust latency based on cpu load
            const qosLatency = Math.floor(OSResourceMonitor.cpu.load * MAX_LATENCY || 0);

            await delay(10 + qosLatency);
        } while (!step?.finalResult && !this._killReason);

        if (this._killReason) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            this.sse.send('agent', {
                eventId,
                action: 'callStop',
                endpointPath,
                id: this.id,
                name: this.name,
                startTime,
                endTime,
                duration,
                input,
                error: 'Agent killed',
            });
            console.warn(`Agent ${this.id} was killed`, AccessCandidate.agent(this.id));
            return { error: 'AGENT_KILLED', reason: this._killReason };
        }
        result = await this.postProcess(step?.finalResult).catch((error) => ({ error }));

        //post process all results
        if (this.agentRuntime.circularLimitReached) {
            const circularLimitData = this.agentRuntime.circularLimitReached;
            result = { error: `Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.circularLimit}` };

            const endTime = Date.now();
            const duration = endTime - startTime;
            this.sse.send('agent', {
                eventId,
                action: 'callStop',
                endpointPath,
                id: this.id,
                name: this.name,
                startTime,
                endTime,
                duration,
                input,
                error: result.error,
            });

            throw new Error(`Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.circularLimit}`);
        }

        if (logId) AgentLogger.log(this, logId, { outputTimestamp: '' + Date.now(), result });

        this.updateTasksCount(); //Important, don't use await here, we need the call to be non blocking

        const endTime = Date.now();
        const duration = endTime - startTime;
        this.sse.send('agent', {
            eventId,
            action: 'callStop',
            endpointPath,
            id: this.id,
            name: this.name,
            startTime,
            endTime,
            duration,
            input,
            result,
        });

        //FIXME: does debug call ever reach this point ?
        return this.agentRuntime.debug ? { state: result, dbgSession, sessionClosed } : result;
    }

    private async updateTasksCount() {
        //tasks count update logic
    }

    @hookAsync('SREAgent.postProcess')
    public async postProcess(_result) {
        let result = JSON.parse(JSON.stringify(_result)); //deep clone the result to avoid modifying the original object
        if (Array.isArray(result)) result = result.flat(Infinity);
        if (!Array.isArray(result)) result = [result];

        //filter out handled errors
        result = result.filter((r) => !(r?.result?._error && r?.result?._error_handled));

        for (let i = 0; i < result.length; i++) {
            const _result = result[i];
            if (!_result) continue;
            if (_result._debug) delete _result._debug;
            if (_result._debug_time) delete _result._debug_time;
            if (_result.result?._debug) delete _result.result._debug;
            if (_result.result?._debug_time) delete _result.result._debug_time;
            const _componentData = this.components[_result.id];
            if (!_componentData) continue;
            const _component: Component = this._componentInstance[_componentData.name];
            if (!_component) continue;
            //if (_component.hasPostProcess) {
            const postProcessResult = await _component.postProcess(_result, _componentData, this).catch((error) => ({ error }));

            result[i] = postProcessResult;
            //}
        }

        if (result.length == 1) result = result[0];
        return result;
    }

    // public saveRuntimeComponentData(componentId, data) {
    //     //let runtimeData = { ...this.agentRuntime.getRuntimeData(componentId), ...data };
    //     //this.agentRuntime.updateComponent(componentId, { runtimeData: data });

    //     this.agentRuntime.saveRuntimeComponentData(componentId, data);
    // }
    // private getRuntimeData(componentId) {
    //     // const componentData = this.agentRuntime.getComponentData(componentId);
    //     // if (!componentData) return {};
    //     // const rData = componentData.runtimeData || {};

    //     return this.agentRuntime.getRuntimeData(componentId);
    // }

    // private clearRuntimeComponentData(componentId) {
    //     this.agentRuntime.resetComponent(componentId);
    // }

    // private hasLoopAncestor(inputEntry) {
    //     if (!inputEntry.prev) return false;
    //     for (let prevId of inputEntry.prev) {
    //         const prevComponentData = this.components[prevId];
    //         if (prevComponentData.name == 'ForEach') return true;

    //         for (let inputEntry of prevComponentData.inputs) {
    //             if (this.hasLoopAncestor(inputEntry)) return true;
    //         }
    //     }
    // }
    private hasLoopAncestor(inputEntry) {
        if (!inputEntry.prev) return false;
        for (let prevId of inputEntry.prev) {
            const prevComponentData = this.components[prevId];
            const prevRuntimeData = this.agentRuntime.getRuntimeData(prevId);

            // Consider any component with _LoopData as a loop ancestor
            if (prevRuntimeData?._LoopData) return true;

            for (let inputEntry of prevComponentData.inputs) {
                if (this.hasLoopAncestor(inputEntry)) return true;
            }
        }
        return false;
    }

    private clearChildLoopRuntimeComponentData(componentId) {
        const componentData = this.components[componentId];
        const runtimeData = this.agentRuntime.getRuntimeData(componentId);
        if (runtimeData._ChildLoopData) {
            for (let inputEntry of componentData.inputs) {
                if (this.hasLoopAncestor(inputEntry)) {
                    delete runtimeData.input[inputEntry.name];
                }
            }
        }
    }
    private getComponentMissingInputs(componentId, _input) {
        let missingInputs: any = [];
        const componentData = this.components[componentId];
        const component: Component = this._componentInstance[componentData.name];
        if (component.alwaysActive) return missingInputs;

        const readablePredecessors = this.findReadablePredecessors(componentId);
        const readableInputNames = {};
        for (let pred of readablePredecessors) {
            if (pred) {
                readableInputNames[pred.input.name] = pred;
            }
        }
        //readablePredecessors.map((e) => e.input.name);

        const allInputIndexes = this.connections.filter((c) => c.targetId == componentId).map((e) => e.targetIndex);
        const allInputs = componentData.inputs.filter((r) => allInputIndexes.includes(r.index));

        if (Array.isArray(allInputs) && allInputs.length > 0) {
            //if the next component has named inputs
            for (let input of allInputs) {
                if (input.optional) continue;
                if (readableInputNames[input.name]) {
                    const pred = readableInputNames[input.name];
                    const component: Component = pred.component;
                    const predComponentData = this.components[pred.id];
                    const foundOutput = component.hasOutput(pred.output.name, predComponentData, this);
                    if (foundOutput) continue; //if the input is readable, skip it, because we can read it's value when needed. Readable inputs are non blocking
                }
                if (typeof _input[input.name] == 'undefined' /* || _input[input.name] == null*/) {
                    missingInputs.push(input.name);
                }
            }
        }

        return missingInputs;
    }

    public findReadablePredecessors(componentId) {
        const componentData = this.components[componentId];
        const component: Component = this._componentInstance[componentData.name];

        const connections = this.connections.filter((c) => c.targetId == componentId);
        const readablePredecessors = connections.map((c) => {
            //this.components[c.sourceId])
            const sourceComponentData = this.components[c.sourceId];
            const sourceComponent: Component = this._componentInstance[sourceComponentData.name];
            const output = sourceComponentData.outputs[c.sourceIndex];
            const input = componentData.inputs[c.targetIndex];
            if (sourceComponent.hasReadOutput) {
                return { output, input, component: sourceComponent, id: c.sourceId };
            }
            return null;
        });

        return readablePredecessors.filter((e) => e != null);
    }

    /**
     *
     * @param sourceId
     * @param componentId
     */
    private updateStep(sourceId, componentId) {
        const agentRuntime = this.agentRuntime;
        const step = agentRuntime.curStep;
        //const componentData = agentRuntime.getComponentData(componentId);

        // if (!componentData.steps) componentData.steps = {};
        // if (!componentData.steps[step]) componentData.steps[step] = { sources: [] };
        // componentData.steps[step].sources.push(sourceId);

        // if (!componentData.stepSources) componentData.stepSources = {};
        // if (!componentData.stepSources[sourceId]) componentData.stepSources[sourceId] = [];
        // componentData.stepSources[sourceId].push(step);

        agentRuntime.updateComponent(componentId, { step });
    }

    @hookAsync('SREAgent.callComponent')
    async callComponent(sourceId, componentId, input?) {
        const startTime = Date.now();
        const agentRuntime = this.agentRuntime;
        const componentData = this.components[componentId];
        const component: Component = this._componentInstance[componentData.name];

        const eventId = 'e-' + uid();

        this.sse.send('component', {
            eventId,
            action: 'callStart',
            sourceId,
            id: componentId,
            name: componentData.displayName,
            title: componentData.title,
            startTime,
            input,
        });

        if (this._killReason) {
            console.warn(`Agent ${this.id} was killed, skipping component ${componentData.name}`, AccessCandidate.agent(this.id));

            const output = { id: componentData.id, name: componentData.displayName, result: null, error: 'Agent killed' };

            const endTime = Date.now();
            const duration = endTime - startTime;
            this.sse.send('component', {
                eventId,
                action: 'callStop',
                sourceId,
                id: componentId,
                name: componentData.displayName,
                title: componentData.title,
                startTime,
                endTime,
                duration,
                output,
            });

            return output;
        }

        if (!component) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            this.sse.send('component', {
                eventId,
                action: 'callStop',
                sourceId,
                id: componentId,
                name: componentData.displayName,
                title: componentData.title,
                startTime,
                endTime,
                duration,
                output: { error: 'Component not found' },
            });
            throw new Error(`Component ${componentData.name} not found`);
        }

        this.agentRuntime.incTag(componentId);
        this.agentRuntime.checkCircularLimit();
        if (this.agentRuntime.circularLimitReached) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            this.sse.send('component', {
                eventId,
                action: 'callStop',
                sourceId,
                id: componentId,
                name: componentData.displayName,
                title: componentData.title,
                startTime,
                endTime,
                duration,
                output: { error: 'Circular Calls Reached' },
            });

            return { error: `Circular Calls Reached` };
        }

        const data = agentRuntime.getComponentData(componentId);
        if (data?.output?._missing_inputs) {
            agentRuntime.updateComponent(componentId, { output: {} });
        }

        const _input = this.prepareComponentInput(componentId, input);

        //insert log
        const logId = AgentLogger.log(this, null, {
            sourceId: sourceId || 'AGENT',
            componentId,
            domain: this.domain,
            workflowID: this.agentRuntime.workflowReqId,
            processID: this.agentRuntime.processID,
            input:
                componentData.name == 'APIEndpoint' ? (this.agentRequest.method == 'GET' ? this.agentRequest.query : this.agentRequest.body) : _input,
            inputTimestamp: new Date().toISOString(),
            sessionID: this.callerSessionId,
            tags: this.sessionTag,
        });

        let output: any = null;
        let missingInputs: any = [];

        //agentRuntime.updateComponent(componentId, { step: agentRuntime.curStep });
        this.updateStep(sourceId, componentId);

        //first we check if the debugger is injecting an output, if yes we skip the inputs check
        if (agentRuntime.debug) {
            output = await agentRuntime.injectDebugOutput(componentId);
        }

        if (!output) {
            missingInputs = this.getComponentMissingInputs(componentId, _input);

            if (missingInputs.length > 0) {
                agentRuntime.updateComponent(componentId, { active: true, status: 'waiting' });
                //check if _error output is connected to a component
                const connections = this.connections.filter((c) => c.sourceId == componentId) || [];
                let hasErrorHandler = false;
                for (let connection of connections) {
                    const outputEndpoint = componentData.outputs[connection.sourceIndex];
                    if (outputEndpoint.name == '_error') {
                        hasErrorHandler = true;
                        break;
                    }
                }
                //if (hasErrorHandler) return { id: componentData.id, name: componentData.name, result: null };

                output = { _error: 'Missing inputs : ' + JSON.stringify(missingInputs), _missing_inputs: missingInputs };
            }

            if (!output) {
                //the following case happens when no debugger injection was performed
                const validationResult = await component.validateConfig(componentData);
                if (validationResult._error) {
                    output = validationResult;
                } else {
                    try {
                        await this.parseVariables(); //make sure that any vault variable is loaded before processing the component
                        //TODO: apply type inference here instead of in the component .process method
                        output = await component.process({ ...this.agentVariables, ..._input }, { ...componentData, eventId }, this);
                        console.debug(output, AccessCandidate.agent(this.id));
                    } catch (error: any) {
                        //this are fatal errors requiring to cancel the execution of this component.
                        console.error(
                            'Error on component process: ',
                            { componentId, name: componentData.name, input: _input },
                            error,
                            AccessCandidate.agent(this.id)
                        );
                        if (error?.message) output = { Response: undefined, _error: error.message, _debug: error.message };
                        else output = { Response: undefined, _error: error.toString(), _debug: error.toString() };
                    }
                }
            }
        }
        const runtimeData = this.agentRuntime.getRuntimeData(componentId);
        agentRuntime.updateComponent(componentId, { output });

        if (output._in_progress) {
            agentRuntime.updateComponent(componentId, { active: true, status: 'in_progress' });
        }

        if (output.error || output._error) {
            //TODO : check if we need to keep loop data while clearing runtime data here
            //in fact, output._error might be connected to a next component, in which case we need to keep the loop data
            if (!runtimeData?._ChildLoopData?._in_progress) {
                //don't reset if we are inside a loop, otherwise ._error branches will break the loop

                this.agentRuntime.resetComponent(componentId);
            }

            if (logId) {
                //update log
                AgentLogger.log(this, logId, { error: output.error || output._error });
            }
            if (output.error) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                this.sse.send('component', {
                    eventId,
                    action: 'callStop',
                    sourceId,
                    id: componentId,
                    name: componentData.displayName,
                    title: componentData.title,
                    startTime,
                    endTime,
                    duration,
                    output: { error: output.error || output._error },
                });

                return [
                    {
                        id: componentData.id,
                        name: componentData.displayName,
                        result: null,
                        error: output.error || output._error,
                        _debug: output.error || output._error,
                    },
                ];
            }
        }

        let results: any = [];
        if (output /*&& !component.hasReadOutput*/ && !output._missing_inputs) {
            AgentLogger.logTask(this, 1); //log successful task (non blocking call)

            //proceed with the next component(s)
            results = await this.callNextComponents(componentId, output).catch((error) => ({
                error,
                id: componentData.id,
                name: componentData.displayName,
            }));

            //TODO : maybe handle the number of branches inside ForEach component
            if (runtimeData._LoopData && output._in_progress && runtimeData._LoopData.branches == undefined) {
                //handle loop branching
                const branches = Array.isArray(results) ? results.length : 1;
                if (output._in_progress) {
                    runtimeData._LoopData.branches = branches;
                    agentRuntime.updateRuntimeData(componentId, { _LoopData: runtimeData._LoopData });
                }
            }

            if (results._is_leaf) {
                //we reached the end of the execution tree, we need to check if this branch is a loop
                delete results._is_leaf;
                const _ChildLoopData = runtimeData._ChildLoopData;
                if (_ChildLoopData && _ChildLoopData.parentId) {
                    const parentId = _ChildLoopData.parentId;
                    const _LoopData = this.agentRuntime.getRuntimeData(parentId)._LoopData;
                    if (_LoopData) {
                        if (!_LoopData.result) _LoopData.result = [];
                        //we are in a loop, we need to update loop parent status in order to signal that we can run the next loop cycle

                        let resultsCopy = JSON.parse(JSON.stringify(results));
                        if (results.result) results.result._exclude = true;

                        resultsCopy = await component.postProcess(resultsCopy, componentData, this);

                        _LoopData.result.push(resultsCopy);
                        _LoopData.branches--;

                        if (_LoopData.branches <= 0) {
                            agentRuntime.updateComponent(parentId, { active: true, status: '' }); //remove _in_progress status after processing all branches
                        }
                        //save the last result so that the loop parent can read it
                        agentRuntime.updateRuntimeData(parentId, { _LoopData });
                    }
                } else {
                    //leaf but no childLoopData, is this a loop component with no children ?
                    const _LoopData = this.agentRuntime.getRuntimeData(componentId)._LoopData;
                    if (_LoopData && _LoopData.loopIndex == 1) {
                        _LoopData._in_progress = false;
                        output._in_progress = false;
                        agentRuntime.updateComponent(componentId, { active: true, status: '' });
                        agentRuntime.updateRuntimeData(componentId, { _LoopData });
                    }
                }
            }
        }

        //check if the component context is potentially needed in next cycles
        if (!output._missing_inputs && !output._in_progress) {
            //we processed the current component, we can now reset the runtime data and active status
            const inLoop =
                runtimeData?._ChildLoopData?._in_progress && runtimeData._ChildLoopData?.loopIndex < runtimeData._ChildLoopData?.loopLength;
            if (inLoop) {
                // loop children require to keep external runtime data, we only clear the data that was set inside the loop
                this.clearChildLoopRuntimeComponentData(componentId);
                agentRuntime.updateComponent(componentId, { active: true, status: 'waiting' });
            } else {
                this.agentRuntime.resetComponent(componentId); //also sets active to false
            }
        } //if inputs were missing, the output contains error information, not actual component processing output, in this case we keep the runtime data

        //filter out null results
        if (Array.isArray(results)) results = results.flat(Infinity).filter((r) => r.result != null);

        if (logId) {
            //update log
            AgentLogger.log(this, logId, { output, outputTimestamp: '' + Date.now() });
        }

        //return this.agentRuntime.debug ? [results, { id: componentData.id, name: componentData.name, result: output }] : results;

        const endTime = Date.now();
        const duration = endTime - startTime;
        this.sse.send('component', {
            eventId,
            action: 'callStop',
            sourceId,
            id: componentId,
            name: componentData.displayName,
            title: componentData.title,
            startTime,
            endTime,
            duration,
            output,
        });

        return [results, { id: componentData.id, name: componentData.displayName, result: output }];
    }
    JSONExpression(obj, propertyString) {
        const properties = propertyString.split(/\.|\[|\]\.|\]\[|\]/).filter(Boolean);
        let currentProperty = obj;

        for (let property of properties) {
            if (currentProperty === undefined || currentProperty === null) {
                return undefined;
            }

            currentProperty = currentProperty[property];
        }

        return currentProperty;
    }

    @hookAsync('SREAgent.callNextComponents')
    async callNextComponents(componentId, output) {
        const agentRuntime = this.agentRuntime;
        //agentRuntime.incStep();

        const componentData = this.components[componentId];
        const component: Component = this._componentInstance[componentData.name];

        //if (component.hasReadOutput) return [];

        //get the list of connections for the current component in order to determine the next component(s) to call
        let connections = this.connections
            .filter((c) => c.sourceId == componentId /*|| this.alwaysActiveComponents[c.sourceId]*/)
            .map((c) => ({ ...c, output, componentData }));

        //also find connections from always active components to components with status 'waiting'

        const waitingComponents = agentRuntime.getWaitingComponents();
        const waitingComponentIds = waitingComponents.map((e) => e.id);
        const alwaysActiveIds = Object.keys(this.agentRuntime.alwaysActiveComponents);
        const alwaysActiveConnections = this.connections
            .filter((c) => alwaysActiveIds.includes(c.sourceId) && waitingComponentIds.includes(c.targetId))
            .map((c) => {
                const output = {};
                const waitingComponent = waitingComponents.find((e) => e.id == c.targetId);
                const prevComponentData = this.components[c.sourceId];
                const prevComponent: Component = this._componentInstance[prevComponentData.name];
                const outputEndpoint = prevComponentData.outputs[c.sourceIndex];
                output[outputEndpoint.name] = prevComponent.readOutput(outputEndpoint.name, prevComponentData, this);

                return { ...c, output, componentData: this.components[c.sourceId] };
            });
        connections = [...connections, ...alwaysActiveConnections];

        //no more components to call, return the output
        if (!Array.isArray(connections) || connections.length == 0) {
            return { id: componentData.id, name: componentData.name, result: output, _is_leaf: true };
        }

        const targetComponents = //classify connections by objects
            connections.reduce((acc, obj) => {
                let key = obj.targetId;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(obj);
                return acc;
            }, {});

        const promises: any = [];
        for (let targetId in targetComponents) {
            const targetComponentData = this.components[targetId];

            //if we are not inside an async component, we skip async branches
            //Note : we exclude Async component from this rule because it's the one that initiates the async job
            if (!this.async && targetComponentData.async && targetComponentData.name !== 'Async') continue;

            const targetComponent: Component = this._componentInstance[targetComponentData.name];
            const connections = targetComponents[targetId];

            let _isErrorHandler = false;
            if (Array.isArray(connections) && connections.length > 0) {
                const nextInput = {};
                for (let connection of connections) {
                    // if (component instanceof Trigger) {
                    //     //handle trigger connections
                    //     console.log('Trigger', connection);
                    //     for (let input of targetComponentData.inputs) {
                    //         if (connection.output?.Payload) {
                    //             nextInput[input.name] = TemplateString(input.defaultVal).parse(connection.output?.Payload).clean().result;
                    //         }
                    //     }
                    //     continue;
                    // }
                    const output = connection.output;
                    const componentData = connection.componentData;
                    const outputEndpoint = componentData.outputs[connection.sourceIndex]; //source
                    const inputEndpoint = targetComponentData.inputs[connection.targetIndex]; //target

                    //outputs can be named (e.g "user:email" or "Req:body:data") in which case they refer to a path in the output object
                    const outputExpression = outputEndpoint.expression || outputEndpoint.name;
                    const outputParts = outputExpression.split('.');

                    const defaultOutputs = componentData.outputs.find((c) => c.default);
                    let value: any = undefined;

                    if (outputEndpoint.name == '_error') _isErrorHandler = true;

                    if (outputEndpoint.default) value = output[outputEndpoint.name] /* || null*/;
                    else {
                        if (defaultOutputs /* && output[defaultOutputs.name]?.[outputEndpoint.name]*/) {
                            value = output[defaultOutputs.name]?.[outputEndpoint.name];
                        }
                    }
                    if (/*value === null || */ value === undefined && outputParts.length >= 1) {
                        let val = this.JSONExpression(output, outputExpression);
                        if (val !== undefined) value = val;
                    }

                    // if (/*value !== null && */ value !== undefined) {
                    //     nextInput[inputEndpoint.name] = [...new Set([[nextInput[inputEndpoint.name], value]].flat(Infinity))].filter(
                    //         (e) => e !== undefined /*&& e !== null*/,
                    //     );

                    //     if (nextInput[inputEndpoint.name].length == 1) nextInput[inputEndpoint.name] = nextInput[inputEndpoint.name][0];
                    // }

                    //Fix suggested by Sentinel Agent
                    if (/*value !== null && */ value !== undefined) {
                        // let combinedInput = [...[nextInput[inputEndpoint.name]].flat(), ...[value].flat()].filter(
                        //     (e) => e !== undefined /*&& e !== null*/,
                        // ); // ! Deprecated

                        let combinedInput = _mergeInputs(nextInput[inputEndpoint.name], value).filter((e) => e !== undefined /*&& e !== null*/);

                        nextInput[inputEndpoint.name] = combinedInput.length === 1 ? combinedInput[0] : combinedInput;
                    }
                }
                if (!nextInput || JSON.stringify(nextInput) == '{}') continue;

                const input = this.prepareComponentInput(targetId, nextInput);

                const targetComponent = this.components[targetId];

                if (_isErrorHandler && targetComponent) {
                    output._error_handled = true;
                }

                const missingInputs = this.getComponentMissingInputs(targetId, input);
                const status = missingInputs.length > 0 ? 'waiting' : undefined;

                const sourceRuntimeData = this.agentRuntime.getRuntimeData(componentId); //We read the previous component runtime data

                let _ChildLoopData = sourceRuntimeData._LoopData; //is the source a loop component ?

                if (!_ChildLoopData || !_ChildLoopData._in_progress) {
                    //if it's a loop component we need to check if the loop is still in progress

                    _ChildLoopData = sourceRuntimeData._ChildLoopData; // if the loop is completed, check if the loop component is a nested loop, in which case we pass the parent context to the following component
                }

                agentRuntime.updateComponent(targetId, { active: true, input: nextInput, sourceId: componentId, status });
                agentRuntime.updateRuntimeData(targetId, { _ChildLoopData, _LoopData: null });
                promises.push(idPromise({ id: targetId, name: targetComponent.name, inputs: nextInput }));

                if (status) {
                    //if status is set, track the component status update
                    //if not set, it means that the component is active and will be logged upon execution
                    //this can be considered as a fake log step that help us keep track of the execution tree
                    const logId = AgentLogger.log(this, null, {
                        sourceId: componentId,
                        componentId: targetId,
                        step: this.agentRuntime.curStep + 1, //we force to next step because the current step order is updated in the next runCycle()
                        domain: this.domain,
                        workflowID: this.agentRuntime.workflowReqId,
                        processID: this.agentRuntime.processID,
                        input: { __action: 'status_update', __status: status, data: nextInput },
                        inputTimestamp: new Date().toISOString(),
                        sessionID: this.callerSessionId,
                        tags: this.sessionTag,
                    });
                }
            }
        }

        if (promises.length == 0) {
            return { id: componentData.id, name: componentData.name, result: output, _is_leaf: true };
        }
        const results = await Promise.all(promises);

        //TODO : exclusive components handling
        //in order to run exclusive components first, we need to run them in current cycle
        //then we signal to the caller component that one more run cycle is needed
        return results.length == 1 ? results[0] : results;
    }
    private prepareComponentInput(targetId, inputs) {
        const rData: any = this.agentRuntime.getRuntimeData(targetId);
        const componentData = this.components[targetId];
        const rDataInput = rData?.input || {};

        let _input = { ...rDataInput };
        if (inputs) {
            // for (let key in inputs) {
            //     let value = inputs[key];
            //     //_input[key] = mergeJsonData(_input[key], value);

            //     _input[key] = [...new Set([[rDataInput[key]], [value]].flat(Infinity))].filter((e) => e !== undefined /* && e !== null*/);
            //     if (_input[key].length == 1) _input[key] = _input[key][0];
            // }

            //Fix suggested by Sentinel Agent
            for (let key in inputs) {
                let value = inputs[key];
                // Concatenate the existing value with the new input, without using Set to preserve duplicates
                // _input[key] = [rDataInput[key], value].flat(Infinity).filter((e) => e !== undefined); // ! Deprecated
                _input[key] = _mergeInputs(rDataInput[key], value).filter((e) => e !== undefined);

                // Simplify the array to a single value if there is only one element after flattening
                if (_input[key].length == 1) _input[key] = _input[key][0];
            }
        }

        const readablePredecessors = this.findReadablePredecessors(targetId);
        for (let c of readablePredecessors) {
            if (c) {
                const predComponentData = this.components[c.id];
                const value = c.component.readOutput(c.output.name, predComponentData, this);
                if (value && c.input?.name) {
                    if (!_input) _input = {};
                    _input[c.input.name] = value;
                }
            }
        }

        //this.saveRuntimeComponentData(targetId, { input: _input }); //TODO : check if we can use this.agentRuntime.updateRuntimeData instead (need to be carefully tested)
        this.agentRuntime.updateRuntimeData(targetId, { input: _input });

        for (let input of componentData.inputs) {
            if (input.defaultVal && _input[input.name] === undefined) {
                _input[input.name] = TemplateString(input.defaultVal).parse(this.agentVariables).result;
                //parseTemplate(input.defaultVal, this.agentVariables, { escapeString: false, processUnmatched: false });
            }
        }
        return _input;
    }

    public getConnectionSource(connection) {
        return this.components[connection.sourceId].inputs.find((e) => e.index === connection.sourceIndex);
    }

    public getConnectionTarget(connection) {
        return this.components[connection.targetId].inputs.find((e) => e.index === connection.targetIndex);
    }

    private recursiveTagAsyncComponents(component) {
        const agent = this;
        for (let output of component.outputs) {
            if (component.name == 'Async' && output.name === 'JobID') continue; //'JobID' is a special output
            const connected = agent.connections.filter((c) => c.sourceId === component.id && c.sourceIndex === output.index);
            if (!connected) continue;
            for (let con of connected) {
                const targetComponent = agent.components[con.targetId];
                if (!targetComponent) continue;
                targetComponent.async = true;
                this.recursiveTagAsyncComponents(targetComponent);
            }
        }
    }
    private tagAsyncComponents() {
        const agent = this;
        const componentsList: any[] = Object.values(agent.components);
        const AsyncComponents: any[] = componentsList.filter((c) => c.name === 'Async');
        if (!AsyncComponents || AsyncComponents.length == 0) return;
        for (let AsyncComponent of AsyncComponents) {
            AsyncComponent.async = true;
            this.recursiveTagAsyncComponents(AsyncComponent);
        }

        //AsyncComponents.async = true;

        //this.recursiveTagAsyncComponents(AsyncComponent, agent);
    }
}

function _mergeInputs(existing, newValue) {
    if (existing === undefined) {
        return [newValue];
    }

    if (!Array.isArray(existing)) {
        existing = [existing];
    }

    return [...existing, newValue];
}
