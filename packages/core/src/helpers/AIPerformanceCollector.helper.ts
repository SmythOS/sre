import { 
    AIComponentMetrics, 
    AIPerformanceEvent, 
    AIPerformanceEventType,
    AIPerformanceConfig,
    MetricWindow
} from '@sre/types/Performance.types';
import { Logger } from './Log.helper';
import { EventEmitter } from 'events';

/**
 * High-performance circular buffer for metrics storage
 */
class CircularMetricsBuffer {
    private buffer: AIComponentMetrics[];
    private head = 0;
    private tail = 0;
    private full = false;
    
    constructor(private capacity: number) {
        this.buffer = new Array(capacity);
    }
    
    push(metric: AIComponentMetrics): void {
        this.buffer[this.head] = metric;
        
        if (this.full) {
            this.tail = (this.tail + 1) % this.capacity;
        }
        
        this.head = (this.head + 1) % this.capacity;
        
        if (this.head === this.tail) {
            this.full = true;
        }
    }
    
    getAll(): AIComponentMetrics[] {
        if (!this.full && this.head === 0) {
            return [];
        }
        
        if (!this.full) {
            return this.buffer.slice(0, this.head);
        }
        
        return [
            ...this.buffer.slice(this.tail),
            ...this.buffer.slice(0, this.head)
        ];
    }
    
    size(): number {
        if (this.full) return this.capacity;
        return this.head;
    }
    
    clear(): void {
        this.head = 0;
        this.tail = 0;
        this.full = false;
    }
}

/**
 * Zero-overhead performance timer with AI-specific tracking
 */
export class AIPerformanceTimer {
    private startTime: number;
    private startMemory: number;
    private checkpoints: Map<string, number> = new Map();
    private llmMetrics: Partial<AIComponentMetrics['llm']> = {};
    
    constructor(
        private componentName: string,
        private agentId: string,
        private configHash: string
    ) {
        this.startTime = performance.now();
        this.startMemory = process.memoryUsage().heapUsed;
    }
    
    /**
     * Add checkpoint for detailed timing analysis
     */
    checkpoint(name: string): void {
        this.checkpoints.set(name, performance.now());
    }
    
    /**
     * Track LLM-specific metrics
     */
    trackLLM(llmData: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        estimatedCost: number;
        contextUtilization?: number;
        qualityScore?: number;
    }): void {
        this.llmMetrics = {
            model: llmData.model,
            tokens: {
                prompt: llmData.promptTokens,
                completion: llmData.completionTokens,
                total: llmData.promptTokens + llmData.completionTokens
            },
            estimatedCost: llmData.estimatedCost,
            contextUtilization: llmData.contextUtilization || 0,
            qualityScore: llmData.qualityScore
        };
    }
    
    /**
     * Complete timing and generate comprehensive metrics
     */
    finish(
        inputData: any = {},
        outputData: any = {},
        success: boolean = true,
        errorType?: string,
        retryCount: number = 0
    ): AIComponentMetrics {
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        const totalTime = endTime - this.startTime;
        
        // Calculate timing breakdown
        const inputProcessingTime = this.checkpoints.get('input_processed') 
            ? this.checkpoints.get('input_processed')! - this.startTime : 0;
        const outputProcessingTime = this.checkpoints.get('output_start') 
            ? endTime - this.checkpoints.get('output_start')! : 0;
        const coreProcessingTime = totalTime - inputProcessingTime - outputProcessingTime;
        const queueTime = this.checkpoints.get('processing_start') 
            ? this.checkpoints.get('processing_start')! - this.startTime : 0;
        
        // Calculate data flow metrics
        const inputSize = this.calculateDataSize(inputData);
        const outputSize = this.calculateDataSize(outputData);
        const transformationRatio = inputSize > 0 ? outputSize / inputSize : 1;
        const complexityScore = this.calculateComplexityScore(inputData, outputData);
        
        // Calculate system impact
        const memoryDelta = endMemory - this.startMemory;
        const memoryPressure = this.calculateMemoryPressure(endMemory);
        const cpuUsage = this.estimateCPUUsage(totalTime);
        
        const metrics: AIComponentMetrics = {
            componentName: this.componentName,
            agentId: this.agentId,
            timing: {
                total: totalTime,
                inputProcessing: inputProcessingTime,
                coreProcessing: coreProcessingTime,
                outputProcessing: outputProcessingTime,
                queueTime: queueTime
            },
            memory: {
                peak: endMemory,
                delta: memoryDelta,
                pressure: memoryPressure
            },
            dataFlow: {
                inputSize,
                outputSize,
                transformationRatio,
                complexityScore
            },
            execution: {
                timestamp: Date.now(),
                success,
                errorType,
                retryCount,
                configHash: this.configHash
            },
            impact: {
                cpuUsage,
                ioOperations: 0, // Would need OS-level monitoring
                networkRequests: 0, // Would need network interception
                cacheStatus: 'n/a' as const
            }
        };
        
        // Add LLM metrics if available
        if (Object.keys(this.llmMetrics).length > 0) {
            metrics.llm = this.llmMetrics as AIComponentMetrics['llm'];
        }
        
        return metrics;
    }
    
    private calculateDataSize(data: any): number {
        try {
            return new TextEncoder().encode(JSON.stringify(data)).length;
        } catch {
            return 0;
        }
    }
    
    private calculateComplexityScore(input: any, output: any): number {
        // Simple heuristic based on nested structure depth and array sizes
        const inputComplexity = this.getObjectComplexity(input);
        const outputComplexity = this.getObjectComplexity(output);
        return Math.max(inputComplexity, outputComplexity);
    }
    
    private getObjectComplexity(obj: any, depth = 0): number {
        if (depth > 10) return 1; // Prevent infinite recursion
        if (typeof obj !== 'object' || obj === null) return 0.1;
        if (Array.isArray(obj)) return Math.min(obj.length * 0.1, 1);
        
        let complexity = Object.keys(obj).length * 0.05;
        for (const value of Object.values(obj)) {
            complexity += this.getObjectComplexity(value, depth + 1) * 0.1;
        }
        
        return Math.min(complexity, 1);
    }
    
    private calculateMemoryPressure(currentMemory: number): number {
        const memoryUsage = process.memoryUsage();
        const totalMemory = memoryUsage.heapTotal;
        return Math.min(currentMemory / totalMemory, 1);
    }
    
    private estimateCPUUsage(executionTime: number): number {
        // Simple heuristic: longer execution time suggests higher CPU usage
        // This would be more accurate with actual CPU monitoring
        return Math.min(executionTime / 1000 * 10, 100);
    }
}

/**
 * Main AI Performance Collector - Enterprise-grade monitoring system
 */
export class AIPerformanceCollector extends EventEmitter {
    private static instance: AIPerformanceCollector;
    private metricsBuffer: Map<string, CircularMetricsBuffer> = new Map();
    private config: AIPerformanceConfig;
    private logger = Logger('AIPerformanceCollector');
    private activeTimers: Map<string, AIPerformanceTimer> = new Map();
    private eventSequence = 0;
    private batchBuffer: AIPerformanceEvent[] = [];
    private flushTimer?: NodeJS.Timeout;
    
    private constructor(config: AIPerformanceConfig) {
        super();
        this.config = { ...DEFAULT_AI_PERFORMANCE_CONFIG, ...config };
        this.setupFlushTimer();
    }
    
    /**
     * Get singleton instance with configuration
     */
    static getInstance(config?: AIPerformanceConfig): AIPerformanceCollector {
        if (!AIPerformanceCollector.instance) {
            AIPerformanceCollector.instance = new AIPerformanceCollector(config || DEFAULT_AI_PERFORMANCE_CONFIG);
        } else if (config) {
            AIPerformanceCollector.instance.updateConfig(config);
        }
        return AIPerformanceCollector.instance;
    }
    
    /**
     * Start monitoring a component execution
     */
    startComponentExecution(
        componentName: string,
        agentId: string,
        config: any = {}
    ): AIPerformanceTimer | null {
        // Check if monitoring is enabled and component is not blacklisted
        if (!this.shouldMonitorComponent(componentName)) {
            return null;
        }
        
        // Always sample critical components, otherwise apply sampling rate
        const isCriticalComponent = ['LLMAssistant', 'GenAILLM'].includes(componentName);
        if (!isCriticalComponent && !this.shouldSample(componentName)) {
            return null;
        }
        
        const configHash = this.generateConfigHash(config);
        const timerId = `${agentId}-${componentName}-${Date.now()}-${Math.random()}`;
        
        const timer = new AIPerformanceTimer(componentName, agentId, configHash);
        this.activeTimers.set(timerId, timer);
        
        // Emit start event
        this.emitEvent({
            type: AIPerformanceEventType.COMPONENT_START,
            source: { agentId, componentName },
            payload: {},
            timestamp: Date.now()
        });
        
        // Auto-cleanup timer after reasonable timeout
        setTimeout(() => {
            if (this.activeTimers.has(timerId)) {
                this.logger.warn(`Timer ${timerId} not properly finished, auto-cleaning`);
                this.activeTimers.delete(timerId);
            }
        }, 300000); // 5 minutes timeout
        
        return timer;
    }
    
    /**
     * Record completed component execution
     */
    recordMetrics(agentId: string, metrics: AIComponentMetrics): void {
        if (!this.config.global.enabled) return;
        
        // Ensure buffer exists for agent
        if (!this.metricsBuffer.has(agentId)) {
            this.metricsBuffer.set(agentId, new CircularMetricsBuffer(this.config.global.bufferSize));
        }
        
        // Store metrics
        this.metricsBuffer.get(agentId)!.push(metrics);
        
        // Emit completion event
        this.emitEvent({
            type: AIPerformanceEventType.COMPONENT_END,
            source: { 
                agentId, 
                componentName: metrics.componentName 
            },
            payload: { metric: metrics },
            timestamp: Date.now()
        });
        
        // Check for performance anomalies
        this.checkPerformanceThresholds(metrics);
        
        this.logger.debug(
            `Recorded metrics for ${metrics.componentName}: ` +
            `${metrics.timing.total.toFixed(2)}ms, ` +
            `${(metrics.memory.delta / 1024 / 1024).toFixed(2)}MB`
        );
    }
    
    /**
     * Get metrics for specific agent within time window
     */
    getAgentMetrics(
        agentId: string, 
        window?: MetricWindow
    ): AIComponentMetrics[] {
        const buffer = this.metricsBuffer.get(agentId);
        if (!buffer) return [];
        
        let metrics = buffer.getAll();
        
        // Apply time window filter
        if (window) {
            metrics = metrics.filter(m => 
                m.execution.timestamp >= window.start && 
                m.execution.timestamp <= window.end
            );
        }
        
        return metrics;
    }
    
    /**
     * Get aggregated metrics across all agents
     */
    getGlobalMetrics(window?: MetricWindow): AIComponentMetrics[] {
        const allMetrics: AIComponentMetrics[] = [];
        
        for (const agentId of this.metricsBuffer.keys()) {
            allMetrics.push(...this.getAgentMetrics(agentId, window));
        }
        
        return allMetrics.sort((a, b) => a.execution.timestamp - b.execution.timestamp);
    }
    
    /**
     * Clear metrics for specific agent
     */
    clearAgentMetrics(agentId: string): void {
        const buffer = this.metricsBuffer.get(agentId);
        if (buffer) {
            buffer.clear();
        }
    }
    
    /**
     * Get current system statistics
     */
    getSystemStats(): {
        activeTimers: number;
        totalMetrics: number;
        memoryUsage: number;
        eventBufferSize: number;
    } {
        let totalMetrics = 0;
        for (const buffer of this.metricsBuffer.values()) {
            totalMetrics += buffer.size();
        }
        
        return {
            activeTimers: this.activeTimers.size,
            totalMetrics,
            memoryUsage: process.memoryUsage().heapUsed,
            eventBufferSize: this.batchBuffer.length
        };
    }
    
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig: Partial<AIPerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Performance collector configuration updated');
    }
    
    /**
     * Export metrics for external monitoring systems
     */
    exportMetrics(format: 'json' | 'prometheus' | 'csv' = 'json'): string {
        const allMetrics = this.getGlobalMetrics();
        
        switch (format) {
            case 'prometheus':
                return this.formatPrometheusMetrics(allMetrics);
            case 'csv':
                return this.formatCSVMetrics(allMetrics);
            default:
                return JSON.stringify(allMetrics, null, 2);
        }
    }
    
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    
    private shouldMonitorComponent(componentName: string): boolean {
        if (!this.config.global.enabled) return false;
        
        const { whitelist, blacklist } = this.config.components;
        
        if (whitelist.length > 0) {
            return whitelist.includes(componentName);
        }
        
        return !blacklist.includes(componentName);
    }
    
    private shouldSample(componentName: string): boolean {
        const customRate = this.config.components.customSamplingRates[componentName];
        const rate = customRate !== undefined ? customRate : this.config.global.samplingRate;
        
        return Math.random() < rate;
    }
    
    private generateConfigHash(config: any): string {
        try {
            return Buffer.from(JSON.stringify(config))
                .toString('base64')
                .substring(0, 8);
        } catch {
            return 'unknown';
        }
    }
    
    private async emitEvent(eventData: Partial<AIPerformanceEvent>): Promise<void> {
        if (!this.config.global.enabled) return;

        const event: AIPerformanceEvent = {
            id: `event-${Date.now()}-${this.eventSequence++}`,
            timestamp: eventData.timestamp || Date.now(),
            type: eventData.type!,
            source: eventData.source!,
            payload: eventData.payload || {},
            processing: {
                latency: Date.now() - (eventData.timestamp || Date.now()),
                sequenceNumber: this.eventSequence
            }
        };
        
        this.batchBuffer.push(event);
        await Promise.resolve(this.emit('performance-event', event));
        
        // Flush if buffer exceeds size
        if (this.batchBuffer.length >= this.config.global.bufferSize) {
            await this.flushBatch();
        }
    }
    
    private async setupFlushTimer(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        this.flushTimer = setInterval(async () => {
            if (this.batchBuffer.length > 0) {
                await this.flushBatch();
            }
        }, this.config.global.flushInterval);
    }
    
    private checkPerformanceThresholds(metrics: AIComponentMetrics): void {
        const { alerts } = this.config;
        if (!alerts.enabled) return;
        
        const { thresholds } = alerts;
        
        // Check latency threshold
        if (metrics.timing.total > thresholds.latencyP95) {
            this.emitEvent({
                type: AIPerformanceEventType.THRESHOLD_EXCEEDED,
                source: {
                    agentId: metrics.agentId,
                    componentName: metrics.componentName
                },
                payload: {
                    alert: {
                        level: 'warning',
                        message: `Component ${metrics.componentName} exceeded latency threshold`,
                        context: { 
                            actualLatency: metrics.timing.total,
                            threshold: thresholds.latencyP95
                        }
                    }
                }
            });
        }
        
        // Check memory threshold
        if (metrics.memory.pressure > thresholds.memoryUsage) {
            this.emitEvent({
                type: AIPerformanceEventType.THRESHOLD_EXCEEDED,
                source: {
                    agentId: metrics.agentId,
                    componentName: metrics.componentName
                },
                payload: {
                    alert: {
                        level: 'warning',
                        message: `Component ${metrics.componentName} exceeded memory pressure threshold`,
                        context: {
                            actualPressure: metrics.memory.pressure,
                            threshold: thresholds.memoryUsage
                        }
                    }
                }
            });
        }
        
        // Check cost threshold (for LLM components)
        if (metrics.llm && metrics.llm.estimatedCost > thresholds.costPerOperation) {
            this.emitEvent({
                type: AIPerformanceEventType.THRESHOLD_EXCEEDED,
                source: {
                    agentId: metrics.agentId,
                    componentName: metrics.componentName
                },
                payload: {
                    alert: {
                        level: 'error',
                        message: `LLM component ${metrics.componentName} exceeded cost threshold`,
                        context: {
                            actualCost: metrics.llm.estimatedCost,
                            threshold: thresholds.costPerOperation,
                            model: metrics.llm.model,
                            tokens: metrics.llm.tokens.total
                        }
                    }
                }
            });
        }
    }
    
    private formatPrometheusMetrics(metrics: AIComponentMetrics[]): string {
        const lines: string[] = [];
        
        // Component execution time
        lines.push('# HELP component_execution_time_seconds Component execution time in seconds');
        lines.push('# TYPE component_execution_time_seconds histogram');
        
        for (const metric of metrics) {
            const labels = `component="${metric.componentName}",agent="${metric.agentId}"`;
            lines.push(
                `component_execution_time_seconds{${labels}} ${metric.timing.total / 1000}`
            );
        }
        
        return lines.join('\n');
    }
    
    private formatCSVMetrics(metrics: AIComponentMetrics[]): string {
        const headers = [
            'timestamp', 'agentId', 'componentName', 'executionTime', 
            'memoryDelta', 'inputSize', 'outputSize', 'success'
        ];
        
        const rows = metrics.map(m => [
            m.execution.timestamp,
            m.agentId,
            m.componentName,
            m.timing.total,
            m.memory.delta,
            m.dataFlow.inputSize,
            m.dataFlow.outputSize,
            m.execution.success
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    /**
     * Graceful shutdown
     */
    private async flushBatch(): Promise<void> {
        if (this.batchBuffer.length === 0) return;
        
        const batchEvents = [...this.batchBuffer];
        this.batchBuffer.length = 0; // Clear buffer
        
        try {
            await Promise.resolve(this.emit('batch-flush', batchEvents));
        } catch (error) {
            this.logger.error(`Error flushing batch: ${error.message}`);
            // Restore events that failed to flush
            this.batchBuffer.push(...batchEvents);
        }
    }

    async shutdown(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        // Emit final batch
        if (this.batchBuffer.length > 0) {
            await this.flushBatch();
        }
        
        this.activeTimers.clear();
        this.metricsBuffer.clear();
        this.removeAllListeners();
        
        this.logger.info('AI Performance Collector shutdown complete');
    }
}

/**
 * Default configuration for development
 */
export const DEFAULT_AI_PERFORMANCE_CONFIG: AIPerformanceConfig = {
    global: {
        enabled: true,
        samplingRate: 1.0,
        bufferSize: 1000,
        flushInterval: 5000
    },
    components: {
        whitelist: [],
        blacklist: ['FSleep', 'FTimestamp'], // Exclude utility components
        customSamplingRates: {
            'LLMAssistant': 1.0,
            'GenAILLM': 1.0,
            'APICall': 0.1
        }
    },
    llm: {
        trackTokenUsage: true,
        trackCosts: true,
        trackQuality: false,
        costThresholds: {
            warning: 0.01,
            critical: 0.10
        }
    },
    alerts: {
        enabled: true,
        thresholds: {
            latencyP95: 5000,  // 5 seconds
            errorRate: 0.05,   // 5%
            memoryUsage: 0.8,  // 80%
            costPerOperation: 0.01 // $0.01
        },
        channels: [
            { type: 'console', config: {} }
        ]
    },
    advanced: {
        enablePredictiveAnalysis: false,
        enableAutoOptimization: false,
        enableSemanticAnalysis: false,
        retentionDays: 7,
        compressionEnabled: true
    }
};
