import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from '../Component.class';
import { LogHelper } from '@sre/helpers/Log.helper';
import express from 'express';
import { AgentRequest } from '@sre/AgentManager/AgentRequest.class';
import { IAgent } from '@sre/types/Agent.types';

export class Trigger extends Component {
    protected logger: LogHelper;

    async process(input, settings, agent: Agent) {
        await super.process(input, settings, agent);
        this.logger = this.createComponentLogger(agent, settings);
        try {
            const agentRequest: AgentRequest = agent.agentRequest;
            const processedRequest = await this.requestHandler(input, settings, agent);
            if (processedRequest) {
                agent.kill('TRIGGER_REQ_HANDLED'); //should not be handled by the agent
                return processedRequest;
            }

            //a trigger should always return an array of payloads
            //if it's a single object, it should be wrapped in an array
            let inputArray = await this.collectPayload(input, settings, agent);
            if (inputArray.length < 2) {
                return { Payload: inputArray?.[0], _error: null, _in_progress: false, _debug: this.logger.output };
            }
            return await this.processIteration(inputArray, settings, agent);
        } catch (error) {
            this.logger.error(error);
            return { Payload: {}, Result: [], _error: error, _in_progress: false, _debug: this.logger.output };
        }
    }
    protected async collectPayload(input, settings, agent: Agent): Promise<any[]> {
        return [];
    }
    public async requestHandler(input, settings, agent: Agent): Promise<any> {}

    protected async processIteration(inputArray, settings, agent) {
        let Payload = {};
        let Result;
        let _temp_result;
        let _error = null;
        let _in_progress = true;
        const logger = this.logger;

        const runtimeData = agent.agentRuntime.getRuntimeData(settings.id);
        const _LoopData = runtimeData._LoopData || { parentId: settings.id, loopIndex: 0, loopLength: inputArray.length };

        logger.debug(`Loop: ${_LoopData.loopIndex} / ${_LoopData.loopLength}`);
        delete _LoopData.branches; //reset branches (the number of branches is calculated in CallComponent@Agent.class.ts )

        if (_LoopData.result) {
            _temp_result = _LoopData.result;
            logger.debug(`  => Trigger Iteration Result : ${JSON.stringify(Payload, null, 2)}`);
            logger.debug(`---------------------------------------------------`);
        }

        Payload = inputArray[_LoopData.loopIndex];

        logger.debug(`  => Trigger Iteration Data : ${JSON.stringify(Payload, null, 2)}`);

        _in_progress = Payload !== undefined;
        if (_in_progress) {
            _LoopData.loopIndex++;
        }
        _LoopData._in_progress = _in_progress;

        agent.agentRuntime.updateRuntimeData(settings.id, { _LoopData: _LoopData });

        if (!_in_progress) {
            Result = (_temp_result || []).map((item) => cleanupResult(item.result || item));
        }
        return { Payload, Result, _temp_result, _error, _in_progress, _debug: logger.output };
    }

    async postProcess(output, settings, agent: Agent): Promise<any> {
        output = await super.postProcess(output, settings, agent);
        return output?.result.Result;
    }

    /**
     * This function is used to register a trigger,
     * It can be called by a visual builder when saving a trigger component.
     * it performs the necessary actions to register the trigger with the external service or with the internal scheduler.
     * @param componentId - The id of the component to register
     * @param componentSettings - The settings of the component to register
     * @param payload - The payload to register the trigger with
     * @returns A promise that resolves to the result of the registration
     */
    async register(componentId: string, componentSettings: any, payload: { agentData: IAgent; triggerUrl: string }) {}
}

function cleanupResult(result) {
    if (typeof result !== 'object') return result;
    if (result._debug) delete result._debug;
    if (result._error) delete result._error;
    if (result._temp_result) delete result._temp_result;
    if (result._in_progress) delete result._in_progress;
    return result;
}
