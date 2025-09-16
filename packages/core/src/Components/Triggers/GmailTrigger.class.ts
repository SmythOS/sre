import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Trigger } from './Trigger.class';

export class GmailTrigger extends Trigger {
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        let Payload = {};
        let Result;
        let _temp_result;
        let _error = null;
        let _in_progress = true;

        let inputArray = [
            {
                message: {
                    id: '123',
                    subject: 'Test 1',
                    body: 'Test 1',
                    from: 'test1@test.com',
                    to: 'test1@test.com',
                    date: '2021-01-01',
                    threadId: '123',
                },
            },
            {
                message: {
                    id: '002',
                    subject: 'Test 2',
                    body: 'Test 2',
                    from: 'test2@test.com',
                    to: 'test2@test.com',
                    date: '2021-01-01',
                    threadId: '002',
                },
            },
        ];

        const logger = this.createComponentLogger(agent, config);
        logger.debug(`=== GmailTrigger Log ===`);

        const runtimeData = agent.agentRuntime.getRuntimeData(config.id);
        const _ForEachData = runtimeData._LoopData || { parentId: config.id, loopIndex: 0, loopLength: inputArray.length };

        logger.debug(`Loop: ${_ForEachData.loopIndex} / ${_ForEachData.loopLength}`);
        delete _ForEachData.branches; //reset branches (the number of branches is calculated in CallComponent@Agent.class.ts )

        if (_ForEachData.result) {
            _temp_result = _ForEachData.result;
            logger.debug(`  => Loop Result : ${JSON.stringify(Payload, null, 2)}`);
            logger.debug(`---------------------------------------------------`);
        }

        Payload = inputArray[_ForEachData.loopIndex];

        logger.debug(`  => Loop Data : ${JSON.stringify(Payload, null, 2)}`);

        _in_progress = Payload !== undefined;
        if (_in_progress) {
            _ForEachData.loopIndex++;
        }
        _ForEachData._in_progress = _in_progress;

        agent.agentRuntime.updateRuntimeData(config.id, { _LoopData: _ForEachData });

        // let Payload = {
        //     message: {
        //         id: '123',
        //         subject: 'Test',
        //         body: 'Test',
        //         from: 'test@test.com',
        //         to: 'test@test.com',
        //         date: '2021-01-01',
        //         threadId: '123',
        //     },
        // };

        //return { Payload, _error, _debug: logger.output };

        return { Payload, Result, _temp_result, _error, _in_progress, _debug: logger.output };
    }
}
