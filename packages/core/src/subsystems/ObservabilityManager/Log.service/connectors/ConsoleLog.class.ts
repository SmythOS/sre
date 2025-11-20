import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { LogConnector } from '../LogConnector';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

const logger = Logger('SmythLog');

export class ConsoleLog extends LogConnector {
    public name: string = 'ConsoleLog';
    public id: string;
    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return Promise.resolve(new ACL());
    }
    protected log(acRequest: AccessRequest, logData: AgentCallLog, callId?: string): Promise<any> {
        logger.debug(`Log for agent ${acRequest.candidate.id}: ${typeof logData === 'string' ? logData : JSON.stringify(logData)}`);

        return Promise.resolve();
    }
    protected logTask(acRequest: AccessRequest, tasks: number, isUsingTestDomain: boolean): Promise<void> {
        logger.debug(
            `${tasks} Task(s) Consumed by agent ${acRequest.candidate.id}: ${isUsingTestDomain ? 'Using Test Domain' : 'Using Production Domain'}`
        );

        return Promise.resolve();
    }
}
