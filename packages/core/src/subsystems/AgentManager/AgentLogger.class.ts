import Agent from './Agent.class';
import { AgentCallLog } from '@sre/types/AgentLogger.types';
import { Logger } from '@sre/helpers/Log.helper';
import { uid } from '@sre/utils';

const console = Logger('AgentLogger');

export default class AgentLogger {
    private static transactions: any = {};
    constructor(private agent: Agent) {}
    public static async cleanup() {
        const trIds = Object.keys(AgentLogger.transactions);
        for (const trId of trIds) {
            const transaction = AgentLogger.transactions[trId];
            if (transaction.canDelete()) {
                delete AgentLogger.transactions[trId];
            }
        }
    }
    public static log(agent, trId, logData: AgentCallLog) {
        if (!trId) trId = 'log-' + uid();
        return trId;
    }
    public static async logTask(agent: Agent, tasks) {}
}
