import Joi from 'joi';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { Logger } from '@sre/helpers/Log.helper';
import { performTypeInference } from '@sre/helpers/TypeChecker.helper';
import { hookAsync } from '@sre/Core/HookService';
import { AIPerformanceCollector, DEFAULT_AI_PERFORMANCE_CONFIG } from '@sre/helpers/AIPerformanceCollector.helper';
import { AIPerformanceTimer } from '@sre/helpers/AIPerformanceCollector.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';

export type TComponentSchema = {
    name: string;
    settings?: Record<string, any>;
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
};

export enum ComponentInputType {
    Any = 'Any',
    Binary = 'Binary',
    String = 'Text',
    Text = 'Text',
    Image = 'Image',
    Video = 'Video',
    Number = 'Number',
    Integer = 'Integer',
    Boolean = 'Boolean',
    Date = 'Date',
    Array = 'Array',
    Object = 'Object',
}
export class Component {
    public hasReadOutput = false;
    public hasPostProcess = true;
    public alwaysActive = false; //for components like readable memories
    public exclusive = false; //for components like writable memories : when exclusive components are active, they are processed in a run cycle bofore other components
    protected schema: TComponentSchema = {
        name: 'Component',
        settings: {},
        inputs: {},
        //outputs: {},
    };
    protected configSchema;
    
    // Performance monitoring properties
    private static performanceCollector: AIPerformanceCollector | null = null;
    private static performanceEnabled = true;
    
    constructor() {}
    init() {}
    
    /**
     * Initialize performance monitoring (called once globally)
     */
    static initializePerformanceMonitoring(): void {
        try {
            if (!Component.performanceCollector && Component.performanceEnabled) {
                // Check if performance monitoring is disabled
                if (process.env.SRE_PERFORMANCE_DISABLED === 'true') {
                    Component.performanceEnabled = false;
                    return;
                }
                
                Component.performanceCollector = AIPerformanceCollector.getInstance(DEFAULT_AI_PERFORMANCE_CONFIG);
            }
        } catch (error) {
            // Silently fail to ensure component functionality isn't affected
            Component.performanceEnabled = false;
        }
    }
    
    /**
     * Disable performance monitoring
     */
    static disablePerformanceMonitoring(): void {
        Component.performanceEnabled = false;
        if (Component.performanceCollector) {
            Component.performanceCollector.shutdown();
            Component.performanceCollector = null;
        }
    }

    createComponentLogger(agent: Agent, configuration: any) {
        const logger = Logger((configuration.name || this.constructor.name) + `,agent<${agent.id}>`, agent?.agentRuntime?.debug);

        logger.on('logged', (info: { level: string; message: string }) => {
            if (agent.sse && configuration.eventId) {
                agent.sse.send('component', {
                    eventId: configuration.eventId,
                    action: 'log',
                    name: configuration.name || this.constructor.name,
                    title: configuration.title,
                    logs: [{ level: info.level, message: info.message }],
                });
            }
        });
        return logger;
    }

    /**
     * Filters config data to only include properties that are defined in the schema
     */
    private filterConfigBySchema(data: any, schema: any): any {
        if (!schema || !data) return data;

        const schemaDescription = schema.describe();

        // If it's not an object schema, return data as-is
        if (schemaDescription.type !== 'object' || !schemaDescription.keys) {
            return data;
        }

        const allowedKeys = Object.keys(schemaDescription.keys);
        const filteredData: any = {};

        // Only include properties that are defined in the schema
        for (const key of allowedKeys) {
            if (key in data) {
                filteredData[key] = data[key];
            }
        }

        // Preserve _templateVars if it exists (special case)
        if (data._templateVars) {
            filteredData._templateVars = data._templateVars;
        }

        return filteredData;
    }

    async validateConfig(config) {
        if (!this.configSchema) return {};

        let workingSchema = this.configSchema;

        if (config.data._templateVars) {
            //Accept dynamically added template data
            for (let tplVar in config.data._templateVars) {
                workingSchema = workingSchema.append({ [tplVar]: Joi.any() });
            }
        }

        // Filter config.data to only include properties defined in the schema
        const filteredData = this.filterConfigBySchema(config.data, workingSchema);

        const valid = await workingSchema.validate(filteredData);
        if (valid.error) {
            return {
                id: config.id,
                name: config.name,
                _error: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`,
                _debug: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`,
            };
        }

        return {};
    }

    @hookAsync('Component.process')
    async process(input, config, agent: Agent): Promise<any> {
        if (agent.isKilled()) {
            throw new Error('Agent killed');
        }
        
        // Initialize performance monitoring if not already done
        Component.initializePerformanceMonitoring();
        
        // Start performance monitoring (zero overhead if disabled)
        const performanceTimer = this.startPerformanceMonitoring(agent, config);
        
        let result: any;
        let success = true;
        let errorType: string | undefined;
        
        try {
            // Mark input processing checkpoint
            performanceTimer?.checkpoint('input_processed');
            
            const _input = await performTypeInference(input, config?.inputs, agent);

            // modify the input object for component's process method
            for (const [key, value] of Object.entries(_input)) {
                input[key] = value;
            }
            
            // Mark processing start checkpoint
            performanceTimer?.checkpoint('processing_start');
            
            // Call the actual component implementation
            result = await this.doProcess(input, config, agent);
            
            // Mark output processing start
            performanceTimer?.checkpoint('output_start');
            
        } catch (error) {
            success = false;
            errorType = error.constructor.name;
            throw error;
        } finally {
            // Record performance metrics
            this.finishPerformanceMonitoring(
                performanceTimer,
                agent,
                input,
                result,
                success,
                errorType
            );
        }
        
        return result;
    }
    
    /**
     * Default implementation for component processing
     * Subclasses should override this method instead of process()
     */
    protected async doProcess(input: any, config: any, agent: Agent): Promise<any> {
        // Default implementation does nothing
        return {};
    }
    async postProcess(output, config, agent: Agent): Promise<any> {
        if (output?.result) {
            if (!agent.agentRuntime?.debug) delete output?.result?._debug;

            if (!output?.result?._error) delete output?.result?._error;
        }
        return output;
    }
    async enable(config, agent: Agent): Promise<any> {}
    async disable(config, agent: Agent): Promise<any> {}
    readOutput(id, config, agent: Agent): any {
        return null;
    }
    hasOutput(id, config, agent: Agent): any {
        return false;
    }
    
    // =============================================================================
    // PERFORMANCE MONITORING METHODS
    // =============================================================================
    
    /**
     * Start performance monitoring for this component
     */
    private startPerformanceMonitoring(agent: Agent, config: any): AIPerformanceTimer | null {
        if (!Component.performanceEnabled || !Component.performanceCollector) {
            return null;
        }
        
        try {
            const componentName = this.constructor.name;
            const configHash = this.generateConfigHash(config);
            
            return Component.performanceCollector.startComponentExecution(
                componentName,
                agent.id,
                config
            );
        } catch (error) {
            // Silently fail to ensure component functionality isn't affected
            return null;
        }
    }
    
    /**
     * Finish performance monitoring and record metrics
     */
    private finishPerformanceMonitoring(
        timer: AIPerformanceTimer | null,
        agent: Agent,
        input: any,
        output: any,
        success: boolean,
        errorType?: string
    ): void {
        if (!timer || !Component.performanceCollector) {
            return;
        }
        
        try {
            // Track LLM metrics if this is an LLM component
            this.trackLLMMetrics(timer, output);
            
            // Finish timing and generate metrics
            const metrics = timer.finish(
                input,
                output,
                success,
                errorType,
                0 // retry count - would need to be tracked separately
            );
            
            // Store metrics through collector
            Component.performanceCollector.recordMetrics(agent.id, metrics);
            
        } catch (error) {
            // Silently fail to ensure component functionality isn't affected
        }
    }
    
    /**
     * Track LLM-specific metrics if applicable
     */
    private trackLLMMetrics(timer: AIPerformanceTimer, output: any): void {
        try {
            // Check if this component used LLM
            const componentName = this.constructor.name.toLowerCase();
            const isLLMComponent = componentName.includes('llm') || 
                                  componentName.includes('genai') || 
                                  componentName.includes('assistant');
            
            if (!isLLMComponent || !output) {
                return;
            }
            
            // Extract LLM metrics from output (component-specific logic)
            let model = 'unknown';
            let promptTokens = 0;
            let completionTokens = 0;
            let estimatedCost = 0;
            
            // Try to extract from common output patterns
            if (output.usage) {
                promptTokens = output.usage.prompt_tokens || 0;
                completionTokens = output.usage.completion_tokens || 0;
            }
            
            if (output.model) {
                model = output.model;
            }
            
            // Estimate cost (rough approximation)
            if (model.includes('gpt-4')) {
                estimatedCost = (promptTokens * 0.00003) + (completionTokens * 0.00006);
            } else if (model.includes('gpt-3.5')) {
                estimatedCost = (promptTokens * 0.0000015) + (completionTokens * 0.000002);
            }
            
            // Track LLM metrics
            timer.trackLLM({
                model,
                promptTokens,
                completionTokens,
                estimatedCost,
                contextUtilization: 0.5, // Default estimate
                qualityScore: undefined
            });
            
        } catch (error) {
            // Silently fail
        }
    }
    
    /**
     * Generate configuration hash for caching and analysis
     */
    private generateConfigHash(config: any): string {
        try {
            // Create a simplified hash of the configuration
            const configString = JSON.stringify({
                name: config?.name,
                data: config?.data ? Object.keys(config.data).sort() : [],
                inputs: config?.inputs ? config.inputs.length : 0
            });
            
            return Buffer.from(configString).toString('base64').substring(0, 8);
        } catch {
            return 'unknown';
        }
    }
    
    /**
     * Get performance metrics for this component type
     */
    public static async getComponentMetrics(componentName?: string): Promise<any> {
        if (!Component.performanceCollector) {
            return null;
        }
        
        try {
            const stats = Component.performanceCollector.getSystemStats();
            return {
                ...stats,
                componentName: componentName || 'all',
                timestamp: Date.now()
            };
        } catch {
            return null;
        }
    }
}
