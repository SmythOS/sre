import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from '../Component.class';
import { LogHelper } from '@sre/helpers/Log.helper';

export class Trigger extends Component {
    protected logger: LogHelper;

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        this.logger = this.createComponentLogger(agent, config);
        try {
            let inputArray = await this.collectPayload(input, config, agent);
            return await this.processIteration(inputArray, config, agent);
        } catch (error) {
            this.logger.error(error);
            return { Payload: {}, Result: [], _error: error, _in_progress: false, _debug: this.logger.output };
        }
    }
    protected async collectPayload(input, config, agent: Agent): Promise<any[]> {
        return [];
    }

    protected async processIteration(inputArray, config, agent) {
        let Payload = {};
        let Result;
        let _temp_result;
        let _error = null;
        let _in_progress = true;
        const logger = this.logger;

        const runtimeData = agent.agentRuntime.getRuntimeData(config.id);
        const _LoopData = runtimeData._LoopData || { parentId: config.id, loopIndex: 0, loopLength: inputArray.length };

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

        agent.agentRuntime.updateRuntimeData(config.id, { _LoopData: _LoopData });

        if (!_in_progress) {
            Result = (_temp_result || []).map((item) => cleanupResult(item.result || item));
        }
        return { Payload, Result, _temp_result, _error, _in_progress, _debug: logger.output };
    }

    async postProcess(output, config, agent: Agent): Promise<any> {
        output = await super.postProcess(output, config, agent);
        return output?.result.Result;
    }
}

function cleanupResult(result) {
    if (typeof result !== 'object') return result;
    if (result._debug) delete result._debug;
    if (result._error) delete result._error;
    if (result._temp_result) delete result._temp_result;
    if (result._in_progress) delete result._in_progress;
    return result;
}
