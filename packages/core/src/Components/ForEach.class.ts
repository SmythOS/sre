import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import { JSONContent } from '@sre/helpers/JsonContent.helper';

export class ForEach extends Component {
    protected configSchema = null;
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        let Loop = {};
        let Result;
        let _temp_result;
        let _error = null;
        let _in_progress = true;
        const logger = this.createComponentLogger(agent, config);
        try {
            const inputObject = input.Input;
            let inputArray;

            //Try to parse multiple arrays formats since forEach always expects and array
            if (Array.isArray(inputObject)) inputArray = inputObject;
            else {
                if (typeof inputObject === 'string') {
                    inputArray = inputObject.trim().startsWith('[') ? JSONContent(inputObject).tryParse() : inputObject.split(',');
                } else {
                    inputArray = [inputObject];
                }
            }

            if (!Array.isArray(inputArray) && typeof inputArray === 'object')
                //if json object, use the values
                inputArray = Object.values(inputArray);

            const runtimeData = agent.agentRuntime.getRuntimeData(config.id);
            const _ForEachData = runtimeData._LoopData || { parentId: config.id, loopIndex: 0, loopLength: inputArray.length };

            logger.debug(`Loop: ${_ForEachData.loopIndex} / ${_ForEachData.loopLength}`);
            delete _ForEachData.branches; //reset branches (the number of branches is calculated in CallComponent@Agent.class.ts )

            if (_ForEachData.result) {
                _temp_result = _ForEachData.result;
                logger.debug(`  => Loop Result : ${JSON.stringify(Loop, null, 2)}`);
                logger.debug(`---------------------------------------------------`);
            }

            Loop = inputArray[_ForEachData.loopIndex];

            logger.debug(`  => Loop Data : ${JSON.stringify(Loop, null, 2)}`);

            _in_progress = Loop !== undefined;
            if (_in_progress) {
                _ForEachData.loopIndex++;
            }
            _ForEachData._in_progress = _in_progress;

            agent.agentRuntime.updateRuntimeData(config.id, { _LoopData: _ForEachData });
        } catch (error: any) {
            _error = error;
            logger.error(error);
        }
        if (!_in_progress) {
            Result = _temp_result || [];

            switch (config?.data?.format) {
                case 'minimal':
                    Result = Result.map((item) => cleanupResult(item.result));
                    break;
                case 'results-array':
                    Result = Result.map((item) => Object.values(cleanupResult(item.result))).flat(Infinity);
                    break;
            }
        }

        return { Loop, Result, _temp_result, _error, _in_progress, _debug: logger.output };
    }
    async postProcess(output, config, agent: Agent): Promise<any> {
        output = await super.postProcess(output, config, agent);
        if (output?.result) {
            delete output.result._temp_result;
            delete output.result._in_progress;
            delete output.result.Loop;
        }
        return output;
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
