/**
 * Job - Wrapper for agent-based scheduled tasks
 *
 * Jobs can execute in three ways:
 * 1. **Skill Execution**: Call a specific agent skill with arguments
 * 2. **Trigger Execution**: Invoke an agent trigger (no arguments)
 * 3. **Prompt Execution**: Send a prompt to an agent for processing
 *
 * All job data is fully serializable, allowing jobs to persist and resume after restart.
 *
 * @example
 * ```typescript
 * // Skill execution job
 * const skillJob = new Job({
 *     type: 'skill',
 *     agentId: 'my-agent',
 *     skillName: 'process_data',
 *     args: { input: 'test data' },
 *     metadata: {
 *         name: 'Data Processing',
 *         description: 'Process data every hour',
 *         retryOnFailure: true,
 *         maxRetries: 3
 *     }
 * });
 *
 * // Trigger execution job
 * const triggerJob = new Job({
 *     type: 'trigger',
 *     agentId: 'my-agent',
 *     triggerName: 'daily_sync',
 *     metadata: {
 *         name: 'Daily Sync',
 *         description: 'Sync data every day at midnight'
 *     }
 * });
 *
 * // Prompt execution job
 * const promptJob = new Job({
 *     type: 'prompt',
 *     agentId: 'my-agent',
 *     prompt: 'Generate daily report',
 *     metadata: {
 *         name: 'Daily Report',
 *         description: 'Generate report every day'
 *     }
 * });
 * ```
 */

import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { hookAsync, HookService } from '@sre/Core/HookService';

export interface IJobMetadata {
    name?: string;
    description?: string;
    tags?: string[];
    retryOnFailure?: boolean;
    maxRetries?: number;
    timeout?: number; // in milliseconds
    [key: string]: any; // Additional custom metadata
}

/**
 * Configuration for a skill-based job
 */
export interface ISkillJobConfig {
    type: 'skill';
    agentId: string;
    skillName: string;
    args?: Record<string, any> | any[];
    metadata?: IJobMetadata;
}

export interface ITriggerJobConfig {
    type: 'trigger';
    agentId: string;
    triggerName: string;
    metadata?: IJobMetadata;
}

/**
 * Configuration for a prompt-based job
 */
export interface IPromptJobConfig {
    type: 'prompt';
    agentId: string;
    prompt: string;
    metadata?: IJobMetadata;
}

export type IJobConfig = ISkillJobConfig | IPromptJobConfig | ITriggerJobConfig;

export class Job {
    private config: IJobConfig;

    constructor(config: IJobConfig) {
        // Validate configuration
        if (!config.type || (config.type !== 'skill' && config.type !== 'prompt' && config.type !== 'trigger')) {
            throw new Error('Job type must be either "skill", "prompt", or "trigger"');
        }
        if (!config.agentId) {
            throw new Error('Job must have an agentId');
        }
        if (config.type === 'skill' && !(config as ISkillJobConfig).skillName) {
            throw new Error('Skill job must have a skillName');
        }
        if (config.type === 'prompt' && !(config as IPromptJobConfig).prompt) {
            throw new Error('Prompt job must have a prompt');
        }
        if (config.type === 'trigger' && !(config as ITriggerJobConfig).triggerName) {
            throw new Error('Trigger job must have a triggerName');
        }

        this.config = {
            ...config,
            metadata: {
                retryOnFailure: false,
                maxRetries: 0,
                tags: [],
                ...config.metadata,
            },
        };
    }

    /**
     * Get the job metadata
     */
    public getMetadata(): IJobMetadata {
        return { ...this.config.metadata };
    }

    /**
     * Get the job configuration
     */
    public getConfig(): IJobConfig {
        return { ...this.config };
    }

    /**
     * Execute the job with error handling and timeout support
     * @returns Execution result
     */
    @hookAsync('Scheduler/Job.execute')
    public async execute(): Promise<{ success: boolean; error?: Error; executionTime: number; result?: any }> {
        const startTime = Date.now();

        try {
            let result: any;

            // Execute with timeout if specified
            if (this.config.metadata.timeout && this.config.metadata.timeout > 0) {
                result = await this.executeWithTimeout(this.config.metadata.timeout);
            } else {
                result = await this.executeInternal();
            }

            const executionTime = Date.now() - startTime;
            return { success: true, executionTime, result };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime,
            };
        }
    }

    /**
     * Internal execution logic based on job type
     */
    private async executeInternal(): Promise<any> {
        if (this.config.type === 'skill') {
            return await this.executeSkill();
        } else if (this.config.type === 'trigger') {
            return await this.executeTrigger();
        } else {
            return await this.executePrompt();
        }
    }

    /**
     * Execute a skill-based job
     */
    private async executeSkill(): Promise<any> {
        const config = this.config as ISkillJobConfig;

        // Get agent data
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const agentData = (await agentDataConnector.getEphemeralAgentData(config.agentId)) || (await agentDataConnector.getAgentData(config.agentId));

        if (!agentData) {
            throw new Error(`Agent ${config.agentId} not found in AgentDataConnector. Make sure the agent is properly registered.`);
        }

        // Handle different agent data structures
        // AgentData can be: { data: { components, connections }, version } or { components, connections }
        const actualData = agentData.data || agentData;
        const components = actualData.components;

        if (!components || !Array.isArray(components)) {
            console.error('Agent data structure:', JSON.stringify(agentData, null, 2));
            throw new Error(
                `Invalid agent data structure for agent ${config.agentId}. ` +
                    `Expected 'components' array but got: ${typeof components}. ` +
                    `Agent data keys: ${Object.keys(actualData || {}).join(', ')}`
            );
        }

        // Find the skill in agent data
        const skill = components.find((c: any) => {
            const endpoint = c.data?.endpoint || c.endpoint;
            return endpoint === config.skillName;
        });

        if (!skill) {
            throw new Error(`Skill ${config.skillName} not found in agent ${config.agentId}`);
        }

        // Prepare request based on skill method
        const method = (skill.data?.method || skill.method || 'POST').toUpperCase();
        const path = `/api/${config.skillName}`;
        const headers = {
            'Content-Type': 'application/json',
        };

        const args = config.args || {};
        const body = method === 'POST' ? args : undefined;
        const query = method === 'GET' ? args : undefined;

        // Load agent and execute
        const agent = AgentProcess.load(agentData);
        await agent.ready();

        const result = await agent.run({ method, path, body, query, headers });
        return result.data;
    }

    /**
     * Execute a trigger-based job
     */
    private async executeTrigger(): Promise<any> {
        const config = this.config as ITriggerJobConfig;

        // Get agent data
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const agentData = (await agentDataConnector.getEphemeralAgentData(config.agentId)) || (await agentDataConnector.getAgentData(config.agentId));

        if (!agentData) {
            throw new Error(`Agent ${config.agentId} not found in AgentDataConnector. Make sure the agent is properly registered.`);
        }

        // Handle different agent data structures
        const actualData = agentData.data || agentData;
        const components = actualData.components;

        if (!components || !Array.isArray(components)) {
            console.error('Agent data structure:', JSON.stringify(agentData, null, 2));
            throw new Error(
                `Invalid agent data structure for agent ${config.agentId}. ` +
                    `Expected 'components' array but got: ${typeof components}. ` +
                    `Agent data keys: ${Object.keys(actualData || {}).join(', ')}`
            );
        }

        // Find the trigger in agent data (triggers have triggerEndpoint property)
        const trigger = components.find((c: any) => {
            const triggerEndpoint = c.data?.triggerEndpoint || c.triggerEndpoint;
            return triggerEndpoint === config.triggerName;
        });

        if (!trigger) {
            throw new Error(`Trigger ${config.triggerName} not found in agent ${config.agentId}`);
        }

        // Prepare request for trigger
        // Triggers don't use HTTP methods like skills, they're just invoked via path
        const path = `/trigger/${config.triggerName}`;
        const headers = {
            'Content-Type': 'application/json',
        };

        // Load agent and execute trigger (triggers don't take arguments)
        const agent = AgentProcess.load(agentData);
        await agent.ready();

        const result = await agent.run({ method: 'POST', path, body: {}, query: {}, headers });
        return result.data;
    }

    /**
     * Execute a prompt-based job
     */
    private async executePrompt(): Promise<any> {
        const config = this.config as IPromptJobConfig;

        // Get agent data
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const agentData = (await agentDataConnector.getEphemeralAgentData(config.agentId)) || (await agentDataConnector.getAgentData(config.agentId));

        if (!agentData) {
            throw new Error(`Agent ${config.agentId} not found`);
        }

        // Handle different agent data structures
        const actualData = agentData.data || agentData;
        const defaultModel = actualData.defaultModel;
        const behavior = actualData.behavior || '';

        if (!defaultModel) {
            throw new Error(`No model configured for agent ${config.agentId}`);
        }

        // Create conversation with agent
        const conversation = new Conversation(
            defaultModel,
            agentData, // spec source (agent data)
            {
                systemPrompt: behavior,
                agentId: config.agentId,
            }
        );

        await conversation.ready;

        // Execute prompt
        const result = await conversation.prompt(config.prompt);
        return result;
    }

    /**
     * Execute the job with retry logic
     * @param retryCount - Current retry attempt
     * @returns Execution result
     */
    public async executeWithRetry(
        retryCount: number = 0
    ): Promise<{ success: boolean; error?: Error; executionTime: number; retries: number; result?: any }> {
        let lastError: Error | undefined;
        let totalExecutionTime = 0;
        let lastResult: any;
        const maxRetries = this.config.metadata.retryOnFailure ? this.config.metadata.maxRetries || 0 : 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const result = await this.execute();
            totalExecutionTime += result.executionTime;
            lastResult = result.result;

            if (result.success) {
                return { success: true, executionTime: totalExecutionTime, retries: attempt, result: lastResult };
            }

            lastError = result.error;

            // Don't retry on the last attempt
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                await this.sleep(Math.min(1000 * Math.pow(2, attempt), 30000));
            }
        }

        return {
            success: false,
            error: lastError,
            executionTime: totalExecutionTime,
            retries: maxRetries,
        };
    }

    /**
     * Execute with timeout
     */
    private async executeWithTimeout(timeoutMs: number): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Job execution timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.executeInternal()
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Serialize job to JSON (everything is serializable now!)
     */
    public toJSON(): IJobConfig {
        return { ...this.config };
    }

    /**
     * Create a Job instance from JSON
     */
    public static fromJSON(config: IJobConfig): Job {
        return new Job(config);
    }
}
