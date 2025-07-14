import fs from 'fs';
import os from 'os';
import path from 'path';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { LogConnector } from '../LogConnector';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

const console = Logger('DebugLog');

export class DebugLog extends LogConnector {
    public name: string = 'DebugLog';
    public id: string;

    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return Promise.resolve(new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner));
    }

    private getLogFile(agentId: string) {
        const dir = path.join(os.homedir(), '.smyth', 'logs', agentId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, 'debug.jsonl');
    }

    protected async log(acRequest: AccessRequest, logData: AgentCallLog, callId?: string): Promise<any> {
        try {
            const file = this.getLogFile(acRequest.candidate.id);
            const entry = {
                timestamp: new Date().toISOString(),
                callId,
                ...logData,
            };
            fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error('Failed to write debug log:', error);
        }
        return Promise.resolve();
    }

    protected async logTask(acRequest: AccessRequest, tasks: number, isUsingTestDomain: boolean): Promise<void> {
        try {
            const file = this.getLogFile(acRequest.candidate.id);
            const entry = {
                timestamp: new Date().toISOString(),
                tasks,
                isUsingTestDomain,
            };
            fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error('Failed to write debug task log:', error);
        }
    }
}
