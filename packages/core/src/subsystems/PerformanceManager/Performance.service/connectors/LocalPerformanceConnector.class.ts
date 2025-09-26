import { PerformanceConnector, IPerformanceRequest } from '../PerformanceConnector';
import { 
    AIComponentMetrics, 
    AIAgentPerformanceReport, 
    AIPerformanceEvent,
    AIPerformanceConfig,
    MetricWindow,
    ComponentBaseline,
    AIPerformanceEventType
} from '@sre/types/Performance.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessRole, TAccessLevel } from '@sre/types/ACL.types';
import { Logger } from '@sre/helpers/Log.helper';
import { AIPerformanceAnalyzer } from '@sre/helpers/AIPerformanceAnalyzer.helper';
import { AIPerformanceCollector, DEFAULT_AI_PERFORMANCE_CONFIG } from '@sre/helpers/AIPerformanceCollector.helper';
import fs from 'fs/promises';
import path from 'path';

/**
 * In-memory data structure for high-performance queries
 */
interface MetricsIndex {
    byAgent: Map<string, AIComponentMetrics[]>;
    byComponent: Map<string, AIComponentMetrics[]>;
    byTimestamp: Map<number, AIComponentMetrics>;
    events: AIPerformanceEvent[];
    baselines: Map<string, ComponentBaseline>;
}

/**
 * Local Performance Connector Implementation
 */
export class LocalPerformanceConnector extends PerformanceConnector {
    public name = 'LocalPerformance';
    public id = 'local-performance-connector';
    
    private metricsIndex: MetricsIndex = {
        byAgent: new Map(),
        byComponent: new Map(),
        byTimestamp: new Map(),
        events: [],
        baselines: new Map()
    };
    
    private config: AIPerformanceConfig = DEFAULT_AI_PERFORMANCE_CONFIG;
    private analyzer = new AIPerformanceAnalyzer();
    private collector: AIPerformanceCollector;
    private logger = Logger('LocalPerformanceConnector');
    private dataDir: string;
    private isInitialized = false;
    
    constructor(settings: any = {}) {
        super();
        this.dataDir = settings.dataDir || path.join(process.cwd(), '.smyth', 'performance');
        this.config = { ...DEFAULT_AI_PERFORMANCE_CONFIG, ...settings.config };
    }
    
    /**
     * Initialize the connector
     */
    async start(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Initialize performance collector
            this.collector = AIPerformanceCollector.getInstance(this.config);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load existing data
            await this.loadPersistedData();
            
            // Set up periodic data persistence
            this.setupPersistence();
            
            this.isInitialized = true;
            this.logger.info('Local Performance Connector initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Local Performance Connector:', error);
            throw error;
        }
    }
    
    /**
     * Shutdown the connector
     */
    async stop(): Promise<void> {
        if (!this.isInitialized) return;
        
        try {
            // Persist final data
            await this.persistData();
            
            // Shutdown collector
            if (this.collector) {
                this.collector.shutdown();
            }
            
            this.isInitialized = false;
            this.logger.info('Local Performance Connector shutdown successfully');
            
        } catch (error) {
            this.logger.error('Error during connector shutdown:', error);
        }
    }
    
    /**
     * Get resource ACL
     */
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        // For local connector, provide basic ACL based on candidate role
        const acl = new ACL();
        
        if (candidate.role === TAccessRole.Agent || candidate.role === TAccessRole.User) {
            acl.addAccess(candidate.role, candidate.id, [TAccessLevel.Read, TAccessLevel.Write]);
        } else {
            // Return empty ACL for Public or other roles - access will be denied
            // The base connector already handles the Public role rejection
        }
        
        return acl;
    }

    /**
     * Override requester method to implement proper access control
     * Create secure requester interface scoped to access candidate
     */
    public requester(candidate: AccessCandidate): IPerformanceRequest {
        // Allow requester creation for any role, but check access at operation level
        return {
            storeMetrics: async (metrics: AIComponentMetrics[]) => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.storeMetrics(candidate.writeRequest, metrics);
            },
            
            getMetrics: async (timeWindow?: MetricWindow) => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.getMetrics(candidate.readRequest, timeWindow);
            },
            
            generateReport: async () => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.generateReport(candidate.readRequest);
            },
            
            clearMetrics: async () => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.clearMetrics(candidate.writeRequest);
            },
            
            getEvents: async (since?: number) => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.getEvents(candidate.readRequest, since);
            },
            
            updateConfig: async (config: Partial<AIPerformanceConfig>) => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.updateConfig(candidate.writeRequest, config);
            },
            
            exportMetrics: async (format: 'json' | 'prometheus' | 'csv') => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.exportMetrics(candidate.readRequest, format);
            },
            
            getBaselines: async () => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.getBaselines(candidate.readRequest);
            },
            
            establishBaseline: async (componentName: string) => {
                if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
                    throw new Error('Only agents and users can access performance monitoring');
                }
                return await this.establishBaseline(candidate.writeRequest, componentName);
            }
        };
    }
    
    // =============================================================================
    // CORE IMPLEMENTATION METHODS
    // =============================================================================
    
    /**
     * Store performance metrics
     */
    protected async storeMetrics(
        accessRequest: AccessRequest, 
        metrics: AIComponentMetrics[]
    ): Promise<void> {
        const agentId = accessRequest.candidate.id;
        
        for (const metric of metrics) {
            // Ensure metric belongs to the requesting agent
            if (metric.agentId !== agentId && accessRequest.candidate.role !== TAccessRole.Public) {
                this.logger.warn(`Metric agentId mismatch: ${metric.agentId} vs ${agentId}`);
                continue;
            }
            
            // Add to indices
            this.addToIndex(metric);
            
            // Check for real-time bottlenecks
            await this.checkRealTimeBottleneck(metric);
        }
        
        this.logger.debug(`Stored ${metrics.length} metrics for agent ${agentId}`);
    }
    
    /**
     * Retrieve metrics with filtering
     */
    protected async getMetrics(
        accessRequest: AccessRequest, 
        timeWindow?: MetricWindow
    ): Promise<AIComponentMetrics[]> {
        const agentId = accessRequest.candidate.id;
        
        let metrics = this.metricsIndex.byAgent.get(agentId) || [];
        
        // Apply time window filter
        if (timeWindow) {
            metrics = metrics.filter(m => 
                m.execution.timestamp >= timeWindow.start && 
                m.execution.timestamp <= timeWindow.end
            );
        }
        
        // Apply aggregation if specified
        if (timeWindow?.aggregation && timeWindow.aggregation !== 'avg') {
            metrics = this.aggregateMetrics(metrics, timeWindow);
        }
        
        return metrics;
    }
    
    /**
     * Generate comprehensive performance report
     */
    protected async generateReport(
        accessRequest: AccessRequest
    ): Promise<AIAgentPerformanceReport> {
        const agentId = accessRequest.candidate.id;
        const metrics = this.metricsIndex.byAgent.get(agentId) || [];
        
        if (metrics.length === 0) {
            throw new Error(`No metrics found for agent ${agentId}`);
        }
        
        // Get agent name (would typically come from agent registry)
        const agentName = `Agent-${agentId}`;
        
        const report = await this.analyzer.analyzeAgentPerformance(
            agentId,
            agentName,
            metrics
        );
        
        this.logger.info(`Generated performance report for agent ${agentId} with ${metrics.length} metrics`);
        
        return report;
    }
    
    /**
     * Clear stored metrics
     */
    protected async clearMetrics(accessRequest: AccessRequest): Promise<void> {
        const agentId = accessRequest.candidate.id;
        
        // Remove from agent index
        this.metricsIndex.byAgent.delete(agentId);
        
        // Remove from component index
        for (const [componentName, componentMetrics] of this.metricsIndex.byComponent) {
            const filtered = componentMetrics.filter(m => m.agentId !== agentId);
            if (filtered.length === 0) {
                this.metricsIndex.byComponent.delete(componentName);
            } else {
                this.metricsIndex.byComponent.set(componentName, filtered);
            }
        }
        
        // Remove from timestamp index
        for (const [timestamp, metric] of this.metricsIndex.byTimestamp) {
            if (metric.agentId === agentId) {
                this.metricsIndex.byTimestamp.delete(timestamp);
            }
        }
        
        // Remove events
        this.metricsIndex.events = this.metricsIndex.events.filter(e => e.source.agentId !== agentId);
        
        this.logger.info(`Cleared metrics for agent ${agentId}`);
    }
    
    /**
     * Get performance events
     */
    protected async getEvents(
        accessRequest: AccessRequest, 
        since?: number
    ): Promise<AIPerformanceEvent[]> {
        const agentId = accessRequest.candidate.id;
        
        let events = this.metricsIndex.events.filter(e => e.source.agentId === agentId);
        
        if (since) {
            events = events.filter(e => e.timestamp >= since);
        }
        
        return events.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    /**
     * Update monitoring configuration
     */
    protected async updateConfig(
        accessRequest: AccessRequest, 
        config: Partial<AIPerformanceConfig>
    ): Promise<void> {
        // Deep merge configuration
        this.config = {
            ...this.config,
            ...config,
            global: {
                ...this.config.global,
                ...config.global
            }
        };
        
        if (this.collector) {
            this.collector.updateConfig(this.config);
            // Clear existing metrics to apply new sampling rate
            this.metricsIndex.byAgent.clear();
            this.metricsIndex.byComponent.clear();
            this.metricsIndex.byTimestamp.clear();
        }
        
        this.logger.info('Performance monitoring configuration updated');
    }
    
    /**
     * Export metrics in various formats
     */
    protected async exportMetrics(
        accessRequest: AccessRequest, 
        format: 'json' | 'prometheus' | 'csv'
    ): Promise<string> {
        const agentId = accessRequest.candidate.id;
        const metrics = this.metricsIndex.byAgent.get(agentId) || [];
        
        switch (format) {
            case 'json':
                return JSON.stringify(metrics, null, 2);
                
            case 'prometheus':
                return this.formatPrometheusMetrics(metrics);
                
            case 'csv':
                return this.formatCSVMetrics(metrics);
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    /**
     * Get component baselines
     */
    protected async getBaselines(
        accessRequest: AccessRequest
    ): Promise<ComponentBaseline[]> {
        return Array.from(this.metricsIndex.baselines.values());
    }
    
    /**
     * Establish baseline for component
     */
    protected async establishBaseline(
        accessRequest: AccessRequest, 
        componentName: string
    ): Promise<ComponentBaseline> {
        const componentMetrics = this.metricsIndex.byComponent.get(componentName) || [];
        
        if (componentMetrics.length < 10) {
            throw new Error(`Insufficient data to establish baseline for ${componentName} (${componentMetrics.length} samples, need 10+)`);
        }
        
        // Use the analyzer's behavior analyzer to establish baseline
        // This would need to be exposed from the analyzer
        const baseline: ComponentBaseline = {
            componentName,
            baseline: {
                latency: {
                    p50: this.percentile(componentMetrics.map(m => m.timing.total), 0.5),
                    p95: this.percentile(componentMetrics.map(m => m.timing.total), 0.95),
                    p99: this.percentile(componentMetrics.map(m => m.timing.total), 0.99)
                },
                memoryUsage: {
                    avg: this.mean(componentMetrics.map(m => m.memory.delta)),
                    peak: Math.max(...componentMetrics.map(m => m.memory.delta))
                },
                successRate: componentMetrics.filter(m => m.execution.success).length / componentMetrics.length,
                costPerOperation: this.mean(
                    componentMetrics.filter(m => m.llm).map(m => m.llm!.estimatedCost)
                )
            },
            established: Date.now(),
            sampleSize: componentMetrics.length,
            confidence: Math.min(1, componentMetrics.length / 100)
        };
        
        this.metricsIndex.baselines.set(componentName, baseline);
        
        this.logger.info(`Established baseline for component ${componentName} with ${componentMetrics.length} samples`);
        
        return baseline;
    }
    
    /**
     * Get connector statistics
     */
    public async getStats(): Promise<{
        totalMetrics: number;
        agentCount: number;
        timeRange: { start: number; end: number };
        storageSize: number;
    }> {
        const allMetrics = Array.from(this.metricsIndex.byAgent.values()).flat();
        const timestamps = allMetrics.map(m => m.execution.timestamp);
        
        return {
            totalMetrics: allMetrics.length,
            agentCount: this.metricsIndex.byAgent.size,
            timeRange: {
                start: Math.min(...timestamps, Date.now()),
                end: Math.max(...timestamps, Date.now())
            },
            storageSize: this.estimateStorageSize()
        };
    }
    
    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================
    
    private addToIndex(metric: AIComponentMetrics): void {
        // Add to agent index
        if (!this.metricsIndex.byAgent.has(metric.agentId)) {
            this.metricsIndex.byAgent.set(metric.agentId, []);
        }
        this.metricsIndex.byAgent.get(metric.agentId)!.push(metric);
        
        // Add to component index
        if (!this.metricsIndex.byComponent.has(metric.componentName)) {
            this.metricsIndex.byComponent.set(metric.componentName, []);
        }
        this.metricsIndex.byComponent.get(metric.componentName)!.push(metric);
        
        // Add to timestamp index
        this.metricsIndex.byTimestamp.set(metric.execution.timestamp, metric);
        
        // Maintain size limits
        this.enforceSizeLimits();
    }
    
    private enforceSizeLimits(): void {
        const maxMetricsPerAgent = this.config.global.bufferSize;
        
        // Limit metrics per agent
        for (const [agentId, metrics] of this.metricsIndex.byAgent) {
            if (metrics.length > maxMetricsPerAgent) {
                const excess = metrics.length - maxMetricsPerAgent;
                const removed = metrics.splice(0, excess);
                
                // Remove from other indices
                for (const metric of removed) {
                    this.metricsIndex.byTimestamp.delete(metric.execution.timestamp);
                }
            }
        }
        
        // Limit events
        const maxEvents = 1000;
        if (this.metricsIndex.events.length > maxEvents) {
            this.metricsIndex.events = this.metricsIndex.events
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, maxEvents);
        }
    }
    
    private async checkRealTimeBottleneck(metric: AIComponentMetrics): Promise<void> {
        try {
            const bottleneck = await this.analyzer.detectRealTimeBottleneck(metric);
            
            if (bottleneck) {
                // Add bottleneck event
                const event: AIPerformanceEvent = {
                    id: `event-bottleneck-${Date.now()}-${Math.random()}`,
                    timestamp: Date.now(),
                    type: AIPerformanceEventType.BOTTLENECK_DETECTED,
                    source: {
                        agentId: metric.agentId,
                        componentName: metric.componentName
                    },
                    payload: { bottleneck },
                    processing: {
                        latency: 0,
                        sequenceNumber: this.metricsIndex.events.length
                    }
                };
                
                this.metricsIndex.events.push(event);
                
                this.logger.warn(`Bottleneck detected in ${metric.componentName}: ${bottleneck.analysis.description}`);
            }
        } catch (error) {
            this.logger.debug(`Error checking real-time bottleneck: ${error.message}`);
        }
    }
    
    private setupEventListeners(): void {
        if (!this.collector) return;
        
        // Listen for performance events from collector
        this.collector.on('performance-event', (event: AIPerformanceEvent) => {
            this.metricsIndex.events.push(event);
        });
        
        // Listen for batch flushes
        this.collector.on('batch-flush', (events: AIPerformanceEvent[]) => {
            this.metricsIndex.events.push(...events);
        });
    }
    
    private async loadPersistedData(): Promise<void> {
        try {
            const dataFile = path.join(this.dataDir, 'metrics.json');
            const configFile = path.join(this.dataDir, 'config.json');
            
            // Load metrics data
            try {
                const metricsData = await fs.readFile(dataFile, 'utf8');
                const parsedData = JSON.parse(metricsData);
                
                // Rebuild indices
                for (const metric of parsedData.metrics || []) {
                    this.addToIndex(metric);
                }
                
                // Load events
                this.metricsIndex.events = parsedData.events || [];
                
                // Load baselines
                for (const baseline of parsedData.baselines || []) {
                    this.metricsIndex.baselines.set(baseline.componentName, baseline);
                }
                
                this.logger.info(`Loaded ${parsedData.metrics?.length || 0} persisted metrics`);
            } catch {
                // No persisted data or error reading - start fresh
                this.logger.info('No persisted metrics data found, starting fresh');
            }
            
            // Load configuration
            try {
                const configData = await fs.readFile(configFile, 'utf8');
                const persistedConfig = JSON.parse(configData);
                this.config = { ...this.config, ...persistedConfig };
            } catch {
                // Use default config
            }
            
        } catch (error) {
            this.logger.warn(`Error loading persisted data: ${error.message}`);
        }
    }
    
    private setupPersistence(): void {
        // Persist data every 5 minutes
        setInterval(async () => {
            try {
                await this.persistData();
            } catch (error) {
                this.logger.error(`Error persisting data: ${error.message}`);
            }
        }, 5 * 60 * 1000);
    }
    
    private async persistData(): Promise<void> {
        try {
            const dataFile = path.join(this.dataDir, 'metrics.json');
            const configFile = path.join(this.dataDir, 'config.json');
            
            // Collect all metrics
            const allMetrics = Array.from(this.metricsIndex.byAgent.values()).flat();
            
            // Prepare data for persistence
            const persistData = {
                metrics: allMetrics,
                events: this.metricsIndex.events.slice(-1000), // Keep last 1000 events
                baselines: Array.from(this.metricsIndex.baselines.values()),
                timestamp: Date.now()
            };
            
            // Write data atomically
            await fs.writeFile(dataFile + '.tmp', JSON.stringify(persistData));
            await fs.rename(dataFile + '.tmp', dataFile);
            
            // Persist configuration
            await fs.writeFile(configFile, JSON.stringify(this.config, null, 2));
            
            this.logger.debug(`Persisted ${allMetrics.length} metrics and ${this.metricsIndex.events.length} events`);
            
        } catch (error) {
            this.logger.error(`Error persisting data: ${error.message}`);
        }
    }
    
    private aggregateMetrics(metrics: AIComponentMetrics[], window: MetricWindow): AIComponentMetrics[] {
        // Simple aggregation - would be more sophisticated in production
        const grouped = new Map<string, AIComponentMetrics[]>();
        
        // Group by component
        for (const metric of metrics) {
            if (!grouped.has(metric.componentName)) {
                grouped.set(metric.componentName, []);
            }
            grouped.get(metric.componentName)!.push(metric);
        }
        
        // Aggregate each group
        const aggregated: AIComponentMetrics[] = [];
        
        for (const [componentName, componentMetrics] of grouped) {
            if (componentMetrics.length === 0) continue;
            
            const representative = componentMetrics[0];
            const aggregatedMetric: AIComponentMetrics = {
                ...representative,
                timing: {
                    total: this.aggregate(componentMetrics.map(m => m.timing.total), window.aggregation),
                    inputProcessing: this.aggregate(componentMetrics.map(m => m.timing.inputProcessing), window.aggregation),
                    coreProcessing: this.aggregate(componentMetrics.map(m => m.timing.coreProcessing), window.aggregation),
                    outputProcessing: this.aggregate(componentMetrics.map(m => m.timing.outputProcessing), window.aggregation),
                    queueTime: this.aggregate(componentMetrics.map(m => m.timing.queueTime), window.aggregation)
                },
                memory: {
                    peak: this.aggregate(componentMetrics.map(m => m.memory.peak), window.aggregation),
                    delta: this.aggregate(componentMetrics.map(m => m.memory.delta), window.aggregation),
                    pressure: this.aggregate(componentMetrics.map(m => m.memory.pressure), window.aggregation)
                },
                execution: {
                    ...representative.execution,
                    timestamp: Math.max(...componentMetrics.map(m => m.execution.timestamp))
                }
            };
            
            aggregated.push(aggregatedMetric);
        }
        
        return aggregated;
    }
    
    private aggregate(values: number[], method: string): number {
        if (values.length === 0) return 0;
        
        switch (method) {
            case 'sum':
                return values.reduce((a, b) => a + b, 0);
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'p95':
                return this.percentile(values, 0.95);
            case 'p99':
                return this.percentile(values, 0.99);
            default: // 'avg'
                return values.reduce((a, b) => a + b, 0) / values.length;
        }
    }
    
    private percentile(values: number[], p: number): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }
    
    private mean(values: number[]): number {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    private formatPrometheusMetrics(metrics: AIComponentMetrics[]): string {
        const lines: string[] = [];
        
        // Component execution time
        lines.push('# HELP component_execution_time_seconds Component execution time in seconds');
        lines.push('# TYPE component_execution_time_seconds histogram');
        
        for (const metric of metrics) {
            const labels = `component="${metric.componentName}",agent="${metric.agentId}"`;
            lines.push(`component_execution_time_seconds{${labels}} ${metric.timing.total / 1000}`);
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
    
    private estimateStorageSize(): number {
        const allMetrics = Array.from(this.metricsIndex.byAgent.values()).flat();
        const avgMetricSize = 1024; // Rough estimate of metric size in bytes
        
        return allMetrics.length * avgMetricSize + 
               this.metricsIndex.events.length * 512 + 
               this.metricsIndex.baselines.size * 256;
    }
}
