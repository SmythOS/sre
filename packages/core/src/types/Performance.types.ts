export interface AIComponentMetrics {
    /** Component identifier */
    componentName: string;
    /** Agent executing this component */
    agentId: string;
    /** Execution timing breakdown */
    timing: {
        /** Total execution time (ms) */
        total: number;
        /** Time spent on input processing (ms) */
        inputProcessing: number;
        /** Time spent on core logic (ms) */
        coreProcessing: number;
        /** Time spent on output processing (ms) */
        outputProcessing: number;
        /** Queue wait time (ms) */
        queueTime: number;
    };
    /** Memory usage analytics */
    memory: {
        /** Peak memory usage during execution (bytes) */
        peak: number;
        /** Memory delta from start to finish (bytes) */
        delta: number;
        /** Memory pressure level (0-1) */
        pressure: number;
    };
    /** Data flow metrics */
    dataFlow: {
        /** Input data size (bytes) */
        inputSize: number;
        /** Output data size (bytes) */
        outputSize: number;
        /** Data transformation ratio */
        transformationRatio: number;
        /** Data complexity score (0-1) */
        complexityScore: number;
    };
    /** LLM-specific metrics (if applicable) */
    llm?: {
        /** Model used for this execution */
        model: string;
        /** Token usage breakdown */
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
        /** Estimated cost in USD */
        estimatedCost: number;
        /** Context window utilization (0-1) */
        contextUtilization: number;
        /** Response quality score (0-1) */
        qualityScore?: number;
    };
    /** Execution result metadata */
    execution: {
        /** Execution timestamp */
        timestamp: number;
        /** Success/failure status */
        success: boolean;
        /** Error type if failed */
        errorType?: string;
        /** Retry count */
        retryCount: number;
        /** Component configuration hash */
        configHash: string;
    };
    /** Performance impact factors */
    impact: {
        /** CPU usage percentage during execution */
        cpuUsage: number;
        /** I/O operations count */
        ioOperations: number;
        /** Network requests made */
        networkRequests: number;
        /** Cache hit/miss status */
        cacheStatus: 'hit' | 'miss' | 'n/a';
    };
}

/**
 * Comprehensive AI agent performance report
 */
export interface AIAgentPerformanceReport {
    /** Report metadata */
    metadata: {
        agentId: string;
        agentName: string;
        reportId: string;
        generatedAt: number;
        analysisWindow: {
            start: number;
            end: number;
            duration?: number;
        };
        version: string;
    };
    /** Executive summary */
    summary: {
        /** Total execution time across all components */
        totalExecutionTime: number;
        /** Total LLM costs */
        totalLLMCosts: number;
        /** Success rate percentage */
        successRate: number;
        /** Performance grade (A-F) */
        performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
        /** Key performance indicators */
        kpis: {
            throughput: number; // operations per second
            latency: number;    // p95 response time
            efficiency: number; // cost per successful operation
            reliability: number; // uptime percentage
        };
    };
    /** Detailed component analysis */
    components: {
        /** Individual component metrics */
        metrics: AIComponentMetrics[];
        /** Component ranking by performance */
        ranking: Array<{
            componentName: string;
            score: number;
            rank: number;
        }>;
        /** Component dependency graph analysis */
        dependencies: {
            criticalPath: string[];
            parallelizationOpportunities: string[][];
            bottleneckComponents: string[];
        };
    };
    /** AI-specific insights */
    aiInsights: {
        /** LLM usage optimization opportunities */
        llmOptimization: {
            modelDowngradeOpportunities: Array<{
                component: string;
                currentModel: string;
                suggestedModel: string;
                potentialSavings: number;
            }>;
            cachingOpportunities: Array<{
                component: string;
                repetitionRate: number;
                potentialSavings: number;
            }>;
            batchingOpportunities: Array<{
                components: string[];
                batchSize: number;
                potentialSavings: number;
            }>;
        };
        /** Semantic analysis of component interactions */
        semanticAnalysis: {
            componentAffinity: Record<string, number>;
            dataFlowEfficiency: number;
            informationLossRate: number;
        };
    };
    /** Performance bottlenecks with AI context */
    bottlenecks: AIPerformanceBottleneck[];
    /** Intelligent optimization recommendations */
    recommendations: AIOptimizationRecommendation[];
    /** Trend analysis and predictions */
    trends: {
        /** Performance trends over time */
        performanceTrend: 'improving' | 'stable' | 'degrading';
        /** Cost trends */
        costTrend: 'improving' | 'stable' | 'degrading';
        /** Predicted future performance */
        predictions: Array<{
            metric: string;
            futureValue: number;
            confidence: number;
            timeframe: number;
        }>;
    };
}

/**
 * AI-aware performance bottleneck
 */
export interface AIPerformanceBottleneck {
    /** Bottleneck identification */
    id: string;
    type: AIBottleneckType;
    severity: BottleneckSeverity;
    /** Component(s) affected */
    affectedComponents: string[];
    /** Detailed analysis */
    analysis: {
        description: string;
        rootCause: string;
        impactAssessment: {
            performanceImpact: number; // percentage degradation
            costImpact: number;        // additional cost per operation
            userExperienceImpact: 'low' | 'medium' | 'high';
        };
    };
    /** AI-specific context */
    aiContext?: {
        modelInefficiency?: {
            model: string;
            taskComplexity: number;
            overProvisioningScore: number;
        };
        semanticBottleneck?: {
            informationLoss: number;
            contextFragmentation: number;
            semanticDrift: number;
        };
    };
    /** Resolution guidance */
    resolution: {
        suggestedFix: string;
        implementationComplexity: 'low' | 'medium' | 'high';
        estimatedResolutionTime: number; // hours
        expectedImprovement: {
            performanceGain: number; // percentage
            costReduction: number;   // percentage
        };
        prerequisites: string[];
    };
    /** Confidence and validation */
    confidence: number; // 0-1
    validatedBy?: 'static_analysis' | 'runtime_profiling' | 'ml_prediction';
}

/**
 * AI-driven optimization recommendation
 */
export interface AIOptimizationRecommendation {
    /** Recommendation metadata */
    id: string;
    type: AIOptimizationType;
    priority: OptimizationPriority;
    category: 'performance' | 'cost' | 'reliability' | 'scalability';
    /** Target components */
    targetComponents: string[];
    /** Recommendation details */
    recommendation: {
        title: string;
        description: string;
        technicalDetails: string;
        implementation: {
            steps: string[];
            codeExamples: Array<{
                language: string;
                code: string;
                description: string;
            }>;
            configuration: Record<string, any>;
        };
    };
    /** Impact analysis */
    impact: {
        performance: {
            latencyImprovement: number;    // percentage
            throughputImprovement: number; // percentage
            memoryReduction: number;       // percentage
        };
        cost: {
            operationalSavings: number; // percentage
            infrastructureSavings: number; // percentage
            llmCostReduction: number; // percentage
        };
        reliability: {
            errorReduction: number;    // percentage
            uptimeImprovement: number; // percentage
        };
    };
    /** Implementation guidance */
    implementation: {
        effort: ImplementationEffort;
        timeline: string;
        risks: Array<{
            description: string;
            probability: number;
            impact: 'low' | 'medium' | 'high';
            mitigation: string;
        }>;
        rollbackStrategy: string;
    };
    /** AI-generated insights */
    aiGenerated: {
        confidence: number;
        reasoning: string;
        similarCases: number;
        validationMethod: string;
    };
}

/**
 * Real-time performance monitoring configuration
 */
export interface AIPerformanceConfig {
    /** Global monitoring settings */
    global: {
        enabled: boolean;
        samplingRate: number; // 0-1
        bufferSize: number;
        flushInterval: number; // ms
    };
    /** Component-specific settings */
    components: {
        whitelist: string[];
        blacklist: string[];
        customSamplingRates: Record<string, number>;
    };
    /** LLM monitoring settings */
    llm: {
        trackTokenUsage: boolean;
        trackCosts: boolean;
        trackQuality: boolean;
        costThresholds: {
            warning: number;
            critical: number;
        };
    };
    /** Alert configuration */
    alerts: {
        enabled: boolean;
        thresholds: {
            latencyP95: number;
            errorRate: number;
            memoryUsage: number;
            costPerOperation: number;
        };
        channels: Array<{
            type: 'console' | 'file' | 'webhook';
            config: Record<string, any>;
        }>;
    };
    /** Advanced features */
    advanced: {
        enablePredictiveAnalysis: boolean;
        enableAutoOptimization: boolean;
        enableSemanticAnalysis: boolean;
        retentionDays: number;
        compressionEnabled: boolean;
    };
}

/**
 * Performance event for real-time streaming
 */
export interface AIPerformanceEvent {
    /** Event metadata */
    id: string;
    timestamp: number;
    type: AIPerformanceEventType;
    source: {
        agentId: string;
        componentName: string;
        sessionId?: string;
    };
    /** Event payload */
    payload: {
        metric?: AIComponentMetrics;
        bottleneck?: AIPerformanceBottleneck;
        recommendation?: AIOptimizationRecommendation;
        alert?: {
            level: 'info' | 'warning' | 'error' | 'critical';
            message: string;
            context: Record<string, any>;
        };
    };
    /** Event processing metadata */
    processing: {
        latency: number; // time from occurrence to event creation
        batchId?: string;
        sequenceNumber: number;
    };
}

// =============================================================================
// ENUMS AND TYPE DEFINITIONS
// =============================================================================

export enum AIBottleneckType {
    LLM_OVERPROVISIONING = 'llm_overprovisioning',
    CONTEXT_FRAGMENTATION = 'context_fragmentation',
    SEMANTIC_BOTTLENECK = 'semantic_bottleneck',
    TOKEN_INEFFICIENCY = 'token_inefficiency',
    MODEL_MISMATCH = 'model_mismatch',
    CACHING_MISS = 'caching_miss',
    SEQUENTIAL_DEPENDENCY = 'sequential_dependency',
    MEMORY_PRESSURE = 'memory_pressure',
    IO_CONTENTION = 'io_contention',
    NETWORK_LATENCY = 'network_latency'
}

export enum BottleneckSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum AIOptimizationType {
    LLM_MODEL_OPTIMIZATION = 'llm_model_optimization',
    SEMANTIC_CACHING = 'semantic_caching',
    CONTEXT_COMPRESSION = 'context_compression',
    PARALLEL_PROCESSING = 'parallel_processing',
    BATCH_OPTIMIZATION = 'batch_optimization',
    MEMORY_POOLING = 'memory_pooling',
    PREDICTIVE_LOADING = 'predictive_loading',
    ADAPTIVE_SAMPLING = 'adaptive_sampling',
    COST_OPTIMIZATION = 'cost_optimization',
    QUALITY_IMPROVEMENT = 'quality_improvement'
}

export enum OptimizationPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ImplementationEffort {
    MINIMAL = 'minimal',      // < 1 day
    LOW = 'low',             // 1-3 days
    MEDIUM = 'medium',       // 1-2 weeks
    HIGH = 'high',           // 2-4 weeks
    EXTENSIVE = 'extensive'   // > 1 month
}

export enum AIPerformanceEventType {
    COMPONENT_START = 'component_start',
    COMPONENT_END = 'component_end',
    BOTTLENECK_DETECTED = 'bottleneck_detected',
    OPTIMIZATION_SUGGESTED = 'optimization_suggested',
    THRESHOLD_EXCEEDED = 'threshold_exceeded',
    ANOMALY_DETECTED = 'anomaly_detected',
    TREND_CHANGE = 'trend_change'
}

/**
 * Performance metric aggregation window
 */
export interface MetricWindow {
    start: number;
    end: number;
    granularity: '1m' | '5m' | '15m' | '1h' | '1d';
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'p95' | 'p99';
}

/**
 * Component performance baseline
 */
export interface ComponentBaseline {
    componentName: string;
    baseline: {
        latency: { p50: number; p95: number; p99: number };
        memoryUsage: { avg: number; peak: number };
        successRate: number;
        costPerOperation: number;
    };
    established: number; // timestamp
    sampleSize: number;
    confidence: number;
}

/**
 * Export interface for external monitoring integration
 */
export interface ExternalMonitoringExport {
    format: 'prometheus' | 'datadog' | 'newrelic' | 'cloudwatch' | 'grafana';
    endpoint?: string;
    credentials?: Record<string, string>;
    tags?: Record<string, string>;
    filters?: {
        components?: string[];
        metrics?: string[];
        severity?: BottleneckSeverity[];
    };
}
