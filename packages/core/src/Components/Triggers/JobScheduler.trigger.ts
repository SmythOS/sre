import { IAgent as Agent, IAgent } from '@sre/types/Agent.types';
import { Trigger } from './Trigger.class';
import { AgentRequest } from '@sre/AgentManager/AgentRequest.class';
import express from 'express';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { ISchedulerRequest } from '@sre/AgentManager/Scheduler.service/SchedulerConnector';
import { Schedule } from '@sre/AgentManager/Scheduler.service/Schedule.class';
import { Job } from '@sre/AgentManager/Scheduler.service/Job.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';

export class JobSchedulerTrigger extends Trigger {
    async collectPayload(input, settings, agent: Agent) {
        const req = agent.agentRequest;

        let payload: any = JSONContent(settings?.data?.payload).tryParse();
        if (typeof payload !== 'object') {
            payload = {};
        }

        return [
            {
                ...payload,
            },
        ];
    }

    async register(componentId: string, componentSettings: any, payload?: { agentData: IAgent; triggerUrl: string }) {
        try {
            const agent: any = payload?.agentData;
            const triggerName = componentSettings.triggerEndpoint;
            const schedulerConnector = ConnectorService.getSchedulerConnector();
            if (!schedulerConnector) {
                throw new Error('Scheduler connector not found');
            }

            const schedulerRequester: ISchedulerRequest = schedulerConnector.agent(agent.id);
            const jobId = `job-${agent.id}-${triggerName}`;
            await schedulerRequester.add(jobId, Schedule.every('10s'), new Job({ agentId: agent.id, type: 'trigger', triggerName }));
        } catch (error) {
            throw new Error('Failed to schedule job');
        }
    }

    async unregister(componentId: string, agent: Agent, payload?: any) {}
}
