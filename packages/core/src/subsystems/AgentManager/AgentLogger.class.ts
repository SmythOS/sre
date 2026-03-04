import { Agent } from './Agent.class';

//import { encode } from 'gpt-tokenizer';
import { AgentCallLog } from '@sre/types/AgentLogger.types';
import { debounce, delay, getDayFormattedDate, uid } from '@sre/utils';
import { Logger } from '@sre/helpers/Log.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import path from 'path';

const console = Logger('AgentLogger.class');

//TODO : for performance optimization we should handle a non blocking logs queue
// in the current implementation, the initial log line write is blocking, log update is non blocking

class LogTransaction {
    private _callId: string = '';
    private queue: any[] = [];
    private _isProcessing: boolean = false;
    private _lastPush: number = 0;
    private storage: StorageConnector;

    constructor(private agent: Agent, private trId: string) {
        this.storage = ConnectorService.getStorageConnector();
    }

    public async getCallId() {
        return this._callId;
    }

    public push(logData: AgentCallLog) {
        const logConnector = ConnectorService.getLogConnector();

        if (!logConnector.valid) return;

        this.queue.push(logData);
        this._lastPush = Date.now();
        this.processQueue();
    }

    private formatData(data: any, maxLength = 1000) {
        if (!data) return undefined;
        let result = typeof data == 'string' ? data : JSON.stringify(data);
        if (result.length > maxLength) {
            result = result.substr(0, maxLength) + '...';
        }
        return result;
    }

    private getDataFilePath(data: any, maxLength = 1000) {
        if (!data) return undefined;
        let str = typeof data == 'string' ? data : JSON.stringify(data);
        if (str.length > maxLength) {
            const dayFolder = getDayFormattedDate();
            const trId = 'L' + uid().toUpperCase();
            return `${dayFolder}/${trId}`;
        }
        return null;
    }

    private prepareData(firstData: AgentCallLog) {
        let sourceId = firstData.sourceId;
        let componentId = firstData.componentId;

        let input = firstData.input
            ? {
                  preview: this.formatData(firstData.input),
                  full: this.getDataFilePath(firstData.input),
                  action: firstData.input.__action,
                  status: firstData.input.__status,
              }
            : undefined;
        let output = firstData.output ? { preview: this.formatData(firstData.output), full: this.getDataFilePath(firstData.output) } : undefined;

        let domain = firstData.domain;
        let inputTimestamp = firstData.inputTimestamp;
        let outputTimestamp = firstData.outputTimestamp;
        let result = firstData.result
            ? JSON.stringify({ preview: this.formatData(firstData.result), full: this.getDataFilePath(firstData.result) })
            : undefined;
        let sessionID = firstData.sessionID;

        const sourceData = this.agent.components[sourceId];
        const componentData = this.agent.components[componentId];
        const sourceCptName = sourceData?.name;
        const componentCptName = componentData?.name;
        const sourceName = sourceData?.displayName || sourceData?.name || sourceId;
        const componentName = componentData?.displayName || componentData?.name || componentId;

        const curStepOrder = firstData.step || this.agent?.agentRuntime?.curStep || '';
        const nextStepOrder = curStepOrder + 1;
        if (sourceCptName) sourceId += `@${sourceCptName}@${curStepOrder}`;
        if (componentCptName) componentId += `@${componentCptName}@${nextStepOrder}`;

        //const inputTokensObj = encode(typeof firstData.input == 'string' ? firstData.input : JSON.stringify(firstData.input) || '');
        //const outputTokensObj = encode(typeof firstData.output == 'string' ? firstData.output : JSON.stringify(firstData.output) || '');
        //const inputTokens = inputTokensObj.length || undefined;
        //const outputTokens = outputTokensObj.length || undefined;

        //token length calculation uses high CPU and does not bring much value ==> disabled
        const inputTokens = undefined;
        const outputTokens = undefined;

        const tags = firstData.tags || '';
        let raw_error =
            firstData.error ||
            firstData?.output?.error ||
            firstData?.output?._error ||
            firstData?.result?.error ||
            firstData?.result?.result?.error ||
            firstData?.result?._error ||
            firstData?.result?.result?._error;

        const error = raw_error ? JSON.stringify({ preview: this.formatData(raw_error), full: this.getDataFilePath(raw_error) }) : undefined;

        return {
            sourceId,
            componentId,
            domain,
            input,
            output,
            inputTimestamp,
            outputTimestamp,
            result,
            error,
            sourceName,
            componentName,
            sessionID,
            inputTokens,
            outputTokens,
            tags,
            workflowID: firstData.workflowID,
            processID: firstData.processID,
            raw_input: firstData.input,
            raw_output: firstData.output,
            raw_result: firstData.result,
            raw_error,
        };
    }

    private async storeLogData(filePath: string, content: any) {
        const logConnector = ConnectorService.getLogConnector();
        if (!logConnector.valid || logConnector.name == 'ConsoleLog') return;

        if (!filePath) return;
        try {
            const body = typeof content == 'string' ? content : JSON.stringify(content);
            // setTeamPath(this.agent.teamId, `logs/${this.agent.id}`);
            // path.posix.join('teams', teamId, category ? category : '');
            const storagePath = path.posix.join('teams', this.agent.teamId, `logs/${this.agent.id}/${filePath}`);
            const metadata = { teamid: this.agent.teamId, agentid: this.agent.id, ContentType: 'text/plain' };
            await this.storage.requester(AccessCandidate.agent(this.agent.id)).write(storagePath, body, undefined, metadata);
        } catch (error) {
            console.error('Error storing Log File : ', filePath, error);
        }
    }

    public async processQueue() {
        const logConnector = ConnectorService.getLogConnector();
        if (!logConnector.valid || this.queue.length <= 0 || this._isProcessing) return;
        this._isProcessing = true;

        try {
            if (!this._callId) {
                const firstData = this.queue.shift();
                const data = this.prepareData(firstData);
                const raw_input = data.raw_input;
                const raw_output = data.raw_output;
                const raw_result = data.raw_result;
                const raw_error = data.raw_error;

                delete data.raw_input;
                delete data.raw_output;
                delete data.raw_result;
                delete data.raw_error;

                const resultObj = data.result ? JSON.parse(data.result) : undefined;
                const errorObj = data.error ? JSON.parse(data.error) : undefined;
                await this.storeLogData(data?.input?.full, raw_input);
                await this.storeLogData(data?.output?.full, raw_output);
                await this.storeLogData(resultObj?.full, raw_result);
                await this.storeLogData(errorObj?.full, raw_error);

                const logResult = await logConnector.requester(AccessCandidate.agent(this.agent.id)).log(data);

                this._callId = logResult?.data?.log?.id;
            } else {
                while (this.queue.length > 0) {
                    const logData = this.queue.shift();
                    const data = this.prepareData(logData);

                    Object.keys(data).forEach((key) => {
                        if (!data[key]) delete data[key];
                    });

                    const raw_input = data.raw_input;
                    const raw_output = data.raw_output;
                    const raw_result = data.raw_result;
                    const raw_error = data.raw_error;

                    delete data.raw_input;
                    delete data.raw_output;
                    delete data.raw_result;
                    delete data.raw_error;

                    const resultObj = data.result ? JSON.parse(data.result) : undefined;
                    const errorObj = data.error ? JSON.parse(data.error) : undefined;
                    await this.storeLogData(data?.input?.full, raw_input);
                    await this.storeLogData(data?.output?.full, raw_output);
                    await this.storeLogData(resultObj?.full, raw_result);
                    await this.storeLogData(errorObj?.full, raw_error);

                    await logConnector.requester(AccessCandidate.agent(this.agent.id)).log(data, this._callId);
                }
            }
        } catch (error) {
            console.error('Error processing log queue:', error?.response?.data?.message || error);
        }

        this._isProcessing = false;
        debounce(this.processQueue.bind(this), 1000, { leading: true, trailing: true, maxWait: 10000 });

        await delay(1000);
        this.processQueue();
    }

    public canDelete() {
        if (this.queue.length > 0) {
            this.processQueue();
            return false;
        }
        return this._lastPush != 0 && this._lastPush + 1000 * 60 * 60 * 1 < Date.now();
    }
}
export class AgentLogger {
    private static transactions: any = {};
    private static cleanupInterval: NodeJS.Timeout;
    constructor(private agent: Agent) {}

    // private static setupCleanupInterval() {
    //     if (this.cleanupInterval) return;
    //     this.cleanupInterval = setInterval(
    //         () => {
    //             this.cleanup();
    //         },
    //         1000 * 60 * 1,
    //     ); //every 1 minute
    // }
    public static async cleanup() {
        const logConnector = ConnectorService.getLogConnector();
        if (!logConnector.valid) return;
        const trIds = Object.keys(AgentLogger.transactions);
        for (const trId of trIds) {
            const transaction = AgentLogger.transactions[trId];
            if (transaction.canDelete()) {
                delete AgentLogger.transactions[trId];
            }
        }
    }
    public static log(agent, trId, logData: AgentCallLog) {
        const logConnector = ConnectorService.getLogConnector();
        if (!logConnector.valid) return;
        if (agent?.agentRuntime?.debug || agent?.debugSessionEnabled) logData.tags = 'DEBUG ';
        if (!trId) trId = 'log-' + uid();
        if (!this.transactions[trId]) {
            this.transactions[trId] = new LogTransaction(agent, trId);
        }
        this.transactions[trId].push(logData);

        //ensure that a cleanup interval is running
        //this.setupCleanupInterval();
        debounce(this.cleanup.bind(this), 1000, { leading: true, trailing: true, maxWait: 10000 * 1 });
        return trId;
    }
    public static async logTask(agent: Agent, tasks) {
        // const token = (await getM2MToken('https://api.smyth.ai')) as string;
        // const day = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
        // const logData = {
        //     number: tasks,
        //     day,
        // };
        // if (!agent.usingTestDomain) {
        //     //only log tasks if debug session is not enabled
        //     mwSysAPI.put(`/quota/agent/${agent.id}/tasks`, logData, includeAuth(token)).catch((error) => {
        //         console.error('Error in AgentLogger.logTask() function: ', error?.response?.data?.message);
        //     });
        // }
        const logConnector = ConnectorService.getLogConnector();
        if (!logConnector.valid) return;

        if (!agent.usingTestDomain) {
            // only report if on a non test domain
            await logConnector.requester(AccessCandidate.agent(agent.id)).logTask(tasks, agent.usingTestDomain);
        }

        //ensure that a cleanup interval is running
        //this.setupCleanupInterval();
        debounce(this.cleanup.bind(this), 1000, { leading: true, trailing: true, maxWait: 10000 * 1 });
    }
}
