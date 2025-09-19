import {
    AIComponentMetrics,
    AIAgentPerformanceReport,
    AIPerformanceBottleneck,
    AIOptimizationRecommendation,
    AIBottleneckType,
    BottleneckSeverity,
    AIOptimizationType,
    OptimizationPriority,
    ImplementationEffort,
    ComponentBaseline
} from '@sre/types/Performance.types';
import { Logger } from './Log.helper';

/**
 * Statistical utilities for performance analysis
 */
class PerformanceStats {
    static percentile(values: number[], p: number): number {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }
    
    static mean(values: number[]): number {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    static median(values: number[]): number {
        return this.percentile(values, 0.5);
    }
    
    static standardDeviation(values: number[]): number {
        const avg = this.mean(values);
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        return Math.sqrt(this.mean(squareDiffs));
    }
    
    static outliers(values: number[], factor: number = 1.5): number[] {
        const q1 = this.percentile(values, 0.25);
        const q3 = this.percentile(values, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - factor * iqr;
        const upperBound = q3 + factor * iqr;
        
        return values.filter(v => v < lowerBound || v > upperBound);
    }
    
    static trendAnalysis(values: number[]): {
        slope: number;
        direction: 'improving' | 'stable' | 'degrading';
        confidence: number;
    } {
        if (values.length < 3) {
            return { slope: 0, direction: 'stable', confidence: 0 };
        }
        
        // Simple linear regression
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        // Calculate R-squared for confidence
        const yMean = sumY / n;
        const totalSumSquares = values.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const predictedY = x.map(xi => (slope * xi) + ((sumY - slope * sumX) / n));
        const residualSumSquares = values.reduce((sum, yi, i) => sum + Math.pow(yi - predictedY[i], 2), 0);
        const rSquared = 1 - (residualSumSquares / totalSumSquares);
        
        const direction = Math.abs(slope) < 0.01 ? 'stable' : 
                         slope > 0 ? 'degrading' : 'improving';
        
        return {
            slope,
            direction,
            confidence: Math.max(0, Math.min(1, rSquared))
        };
    }
}

/**
 * ML-powered component behavior analyzer
 */
class ComponentBehaviorAnalyzer {
    private baselines: Map<string, ComponentBaseline> = new Map();
    
    /**
     * Establish performance baseline for component
     */
    establishBaseline(componentName: string, metrics: AIComponentMetrics[]): ComponentBaseline {
        if (metrics.length < 10) {
            throw new Error(`Insufficient data for baseline (${metrics.length} samples, need 10+)`);
        }
        
        const latencies = metrics.map(m => m.timing.total);
        const memoryUsages = metrics.map(m => m.memory.delta);
        const successRate = metrics.filter(m => m.execution.success).length / metrics.length;
        const costs = metrics
            .filter(m => m.llm)
            .map(m => m.llm!.estimatedCost);
        
        const baseline: ComponentBaseline = {
            componentName,
            baseline: {
                latency: {
                    p50: PerformanceStats.percentile(latencies, 0.5),
                    p95: PerformanceStats.percentile(latencies, 0.95),
                    p99: PerformanceStats.percentile(latencies, 0.99)
                },
                memoryUsage: {
                    avg: PerformanceStats.mean(memoryUsages),
                    peak: Math.max(...memoryUsages)
                },
                successRate,
                costPerOperation: costs.length > 0 ? PerformanceStats.mean(costs) : 0
            },
            established: Date.now(),
            sampleSize: metrics.length,
            confidence: Math.min(1, metrics.length / 100) // Confidence increases with sample size
        };
        
        this.baselines.set(componentName, baseline);
        return baseline;
    }
    
    /**
     * Detect anomalies based on baseline
     */
    detectAnomalies(componentName: string, metric: AIComponentMetrics): {
        isAnomaly: boolean;
        severity: BottleneckSeverity;
        deviations: Array<{
            metric: string;
            current: number;
            baseline: number;
            deviation: number;
        }>;
    } {
        const baseline = this.baselines.get(componentName);
        if (!baseline) {
            return { isAnomaly: false, severity: BottleneckSeverity.LOW, deviations: [] };
        }
        
        const deviations = [];
        let maxDeviation = 0;
        
        // Check latency deviation
        const latencyDeviation = (metric.timing.total - baseline.baseline.latency.p95) / baseline.baseline.latency.p95;
        if (Math.abs(latencyDeviation) > 0.2) { // 20% threshold
            deviations.push({
                metric: 'latency',
                current: metric.timing.total,
                baseline: baseline.baseline.latency.p95,
                deviation: latencyDeviation
            });
            maxDeviation = Math.max(maxDeviation, Math.abs(latencyDeviation));
        }
        
        // Check memory deviation
        const memoryDeviation = (metric.memory.delta - baseline.baseline.memoryUsage.avg) / baseline.baseline.memoryUsage.avg;
        if (Math.abs(memoryDeviation) > 0.3) { // 30% threshold
            deviations.push({
                metric: 'memory',
                current: metric.memory.delta,
                baseline: baseline.baseline.memoryUsage.avg,
                deviation: memoryDeviation
            });
            maxDeviation = Math.max(maxDeviation, Math.abs(memoryDeviation));
        }
        
        // Check cost deviation (for LLM components)
        if (metric.llm && baseline.baseline.costPerOperation > 0) {
            const costDeviation = (metric.llm.estimatedCost - baseline.baseline.costPerOperation) / baseline.baseline.costPerOperation;
            if (Math.abs(costDeviation) > 0.5) { // 50% threshold
                deviations.push({
                    metric: 'cost',
                    current: metric.llm.estimatedCost,
                    baseline: baseline.baseline.costPerOperation,
                    deviation: costDeviation
                });
                maxDeviation = Math.max(maxDeviation, Math.abs(costDeviation));
            }
        }
        
        const severity = maxDeviation > 2.0 ? BottleneckSeverity.CRITICAL :
                        maxDeviation > 1.0 ? BottleneckSeverity.HIGH :
                        maxDeviation > 0.5 ? BottleneckSeverity.MEDIUM :
                        BottleneckSeverity.LOW;
        
        return {
            isAnomaly: deviations.length > 0,
            severity,
            deviations
        };
    }
    
    /**
     * Predict component affinity based on execution patterns
     */
    analyzeComponentAffinity(metrics: AIComponentMetrics[]): Record<string, number> {
        const componentSequences: string[][] = [];
        const agentGroups = new Map<string, AIComponentMetrics[]>();
        
        // Group by agent
        for (const metric of metrics) {
            if (!agentGroups.has(metric.agentId)) {
                agentGroups.set(metric.agentId, []);
            }
            agentGroups.get(metric.agentId)!.push(metric);
        }
        
        // Extract component execution sequences
        for (const agentMetrics of agentGroups.values()) {
            const sorted = agentMetrics.sort((a, b) => a.execution.timestamp - b.execution.timestamp);
            componentSequences.push(sorted.map(m => m.componentName));
        }
        
        // Calculate component co-occurrence
        const coOccurrence = new Map<string, Map<string, number>>();
        
        for (const sequence of componentSequences) {
            for (let i = 0; i < sequence.length - 1; i++) {
                const current = sequence[i];
                const next = sequence[i + 1];
                
                if (!coOccurrence.has(current)) {
                    coOccurrence.set(current, new Map());
                }
                
                const currentMap = coOccurrence.get(current)!;
                currentMap.set(next, (currentMap.get(next) || 0) + 1);
            }
        }
        
        // Normalize to affinity scores
        const affinity: Record<string, number> = {};
        
        for (const [component, nextComponents] of coOccurrence) {
            const total = Array.from(nextComponents.values()).reduce((a, b) => a + b, 0);
            
            for (const [nextComponent, count] of nextComponents) {
                const affinityScore = count / total;
                affinity[`${component}->${nextComponent}`] = affinityScore;
            }
        }
        
        return affinity;
    }
}

/**
 * Advanced AI Performance Analyzer
 */
export class AIPerformanceAnalyzer {
    private behaviorAnalyzer = new ComponentBehaviorAnalyzer();
    private logger = Logger('AIPerformanceAnalyzer');
    
    /**
     * Generate comprehensive AI agent performance report
     */
    async analyzeAgentPerformance(
        agentId: string,
        agentName: string,
        metrics: AIComponentMetrics[],
        timeWindow?: { start: number; end: number }
    ): Promise<AIAgentPerformanceReport> {
        if (metrics.length === 0) {
            throw new Error('No metrics available for analysis');
        }
        
        this.logger.info(`Analyzing performance for agent ${agentName} (${metrics.length} metrics)`);
        
        // Calculate summary statistics
        const summary = this.calculateSummaryStats(metrics);
        
        // Analyze component performance
        const componentAnalysis = this.analyzeComponentPerformance(metrics);
        
        // Detect performance bottlenecks
        const bottlenecks = await this.detectBottlenecks(metrics);
        
        // Generate optimization recommendations
        const recommendations = await this.generateOptimizationRecommendations(metrics, bottlenecks);
        
        // Analyze AI-specific patterns
        const aiInsights = this.analyzeAISpecificPatterns(metrics);
        
        // Trend analysis
        const trends = this.analyzeTrends(metrics);
        
        const report: AIAgentPerformanceReport = {
            metadata: {
                agentId,
                agentName,
                reportId: `report-${agentId}-${Date.now()}`,
                generatedAt: Date.now(),
                // Around line 321
                analysisWindow: timeWindow || (() => {
                    const start = Math.min(...metrics.map(m => m.execution.timestamp));
                    const end = Math.max(...metrics.map(m => m.execution.timestamp));
                    return {
                        start,
                        end,
                        duration: end - start
                    };
                })(),
                version: '1.0.0'
            },
            summary,
            components: componentAnalysis,
            aiInsights,
            bottlenecks,
            recommendations,
            trends
        };
        
        this.logger.info(`Generated performance report with ${bottlenecks.length} bottlenecks and ${recommendations.length} recommendations`);
        
        return report;
    }
    
    /**
     * Real-time bottleneck detection
     */
    async detectRealTimeBottleneck(metric: AIComponentMetrics): Promise<AIPerformanceBottleneck | null> {
        if (!metric) return null;
        
        try {
            // Check for LLM-specific bottlenecks first (don't need baseline)
            if (metric.llm && metric.llm.estimatedCost > 0.05) {
                return {
                    id: `bottleneck-${metric.agentId}-${metric.componentName}-${Date.now()}`,
                    type: AIBottleneckType.LLM_OVERPROVISIONING,
                    severity: BottleneckSeverity.HIGH,
                    affectedComponents: [metric.componentName],
                    analysis: {
                        description: `High LLM costs detected in ${metric.componentName}`,
                        rootCause: 'Potentially using over-powered model or inefficient prompting',
                        impactAssessment: {
                            performanceImpact: 0,
                            costImpact: metric.llm.estimatedCost,
                            userExperienceImpact: 'low'
                        }
                    },
                    resolution: {
                        suggestedFix: 'Consider using gpt-3.5-turbo for this task',
                        implementationComplexity: 'low',
                        estimatedResolutionTime: 4,
                        expectedImprovement: {
                            performanceGain: 0,
                            costReduction: 30
                        },
                        prerequisites: ['Model comparison testing']
                    },
                    confidence: 0.9,
                    validatedBy: 'runtime_profiling'
                };
            }
            
            // Check for high latency bottlenecks (don't need baseline)
            if (metric.timing.total >= 10000) { // 10 seconds threshold (inclusive)
                return {
                    id: `bottleneck-${metric.agentId}-${metric.componentName}-${Date.now()}`,
                    type: AIBottleneckType.SEQUENTIAL_DEPENDENCY,
                    severity: BottleneckSeverity.HIGH,
                    affectedComponents: [metric.componentName],
                    analysis: {
                        description: `High latency detected in ${metric.componentName}`,
                        rootCause: 'Sequential processing causing performance bottleneck',
                        impactAssessment: {
                            performanceImpact: 50,
                            costImpact: metric.llm?.estimatedCost || 0,
                            userExperienceImpact: 'high'
                        }
                    },
                    resolution: {
                        suggestedFix: 'Implement parallel processing where possible',
                        implementationComplexity: 'high',
                        estimatedResolutionTime: 16,
                        expectedImprovement: {
                            performanceGain: 40,
                            costReduction: 0
                        },
                        prerequisites: ['Dependency analysis', 'Concurrency testing']
                    },
                    confidence: 0.8,
                    validatedBy: 'runtime_profiling'
                };
            }
            
            // Try anomaly detection with baseline if available
            const anomaly = this.behaviorAnalyzer.detectAnomalies(metric.componentName, metric);
            
            if (anomaly.isAnomaly && anomaly.deviations.length > 0) {
                const bottleneckType = this.classifyBottleneckType(metric, anomaly);
                
                return {
                    id: `bottleneck-${metric.agentId}-${metric.componentName}-${Date.now()}`,
                    type: bottleneckType,
                    severity: anomaly.severity,
                    affectedComponents: [metric.componentName],
                    analysis: {
                        description: this.generateBottleneckDescription(metric, anomaly),
                        rootCause: this.identifyRootCause(metric, anomaly),
                        impactAssessment: {
                            performanceImpact: this.calculatePerformanceImpact(anomaly),
                            costImpact: metric.llm?.estimatedCost || 0,
                            userExperienceImpact: anomaly.severity === BottleneckSeverity.CRITICAL ? 'high' : 
                                             anomaly.severity === BottleneckSeverity.HIGH ? 'medium' : 'low'
                        }
                    },
                    resolution: {
                        suggestedFix: this.generateFixSuggestion(bottleneckType, metric),
                        implementationComplexity: this.assessImplementationComplexity(bottleneckType),
                        estimatedResolutionTime: this.estimateResolutionTime(bottleneckType),
                        expectedImprovement: {
                            performanceGain: this.estimatePerformanceGain(bottleneckType),
                            costReduction: this.estimateCostReduction(bottleneckType, metric)
                        },
                        prerequisites: this.getPrerequisites(bottleneckType)
                    },
                    confidence: 0.8,
                    validatedBy: 'runtime_profiling'
                };
            }
            
            return null;
        } catch (error) {
            this.logger.warn(`Error detecting real-time bottleneck: ${error.message}`);
            return null;
        }
    }
    
    // =============================================================================
    // PRIVATE ANALYSIS METHODS
    // =============================================================================
    
    private calculateSummaryStats(metrics: AIComponentMetrics[]) {
        const executionTimes = metrics.map(m => m.timing.total);
        const successRate = metrics.filter(m => m.execution.success).length / metrics.length;
        const llmCosts = metrics.filter(m => m.llm).map(m => m.llm!.estimatedCost);
        const totalLLMCosts = llmCosts.reduce((sum, cost) => sum + cost, 0);
        
        const throughput = metrics.length / (
            (Math.max(...metrics.map(m => m.execution.timestamp)) - 
             Math.min(...metrics.map(m => m.execution.timestamp))) / 1000
        );
        
        return {
            totalExecutionTime: executionTimes.reduce((a, b) => a + b, 0),
            totalLLMCosts,
            successRate,
            performanceGrade: this.calculatePerformanceGrade(successRate, PerformanceStats.percentile(executionTimes, 0.95)),
            kpis: {
                throughput: throughput || 0,
                latency: PerformanceStats.percentile(executionTimes, 0.95),
                efficiency: totalLLMCosts / Math.max(1, metrics.filter(m => m.execution.success).length),
                reliability: successRate
            }
        };
    }
    
    private analyzeComponentPerformance(metrics: AIComponentMetrics[]) {
        const componentGroups = new Map<string, AIComponentMetrics[]>();
        
        // Group metrics by component
        for (const metric of metrics) {
            if (!componentGroups.has(metric.componentName)) {
                componentGroups.set(metric.componentName, []);
            }
            componentGroups.get(metric.componentName)!.push(metric);
        }
        
        // Calculate component rankings
        const ranking = Array.from(componentGroups.entries()).map(([name, componentMetrics]) => {
            const avgLatency = PerformanceStats.mean(componentMetrics.map(m => m.timing.total));
            const successRate = componentMetrics.filter(m => m.execution.success).length / componentMetrics.length;
            const avgMemory = PerformanceStats.mean(componentMetrics.map(m => m.memory.delta));
            
            // Simple scoring algorithm (lower is better)
            const score = (avgLatency / 1000) + (1 - successRate) * 10 + (avgMemory / 1024 / 1024);
            
            return { componentName: name, score, rank: 0 };
        }).sort((a, b) => a.score - b.score);
        
        // Assign ranks
        ranking.forEach((item, index) => {
            item.rank = index + 1;
        });
        
        // Analyze dependencies and parallelization opportunities
        const affinity = this.behaviorAnalyzer.analyzeComponentAffinity(metrics);
        const criticalPath = this.findCriticalPath(componentGroups);
        const parallelizationOpportunities = this.findParallelizationOpportunities(affinity);
        const bottleneckComponents = ranking.slice(0, Math.ceil(ranking.length * 0.2)).map(r => r.componentName);
        
        return {
            metrics,
            ranking,
            dependencies: {
                criticalPath,
                parallelizationOpportunities,
                bottleneckComponents
            }
        };
    }
    
    private async detectBottlenecks(metrics: AIComponentMetrics[]): Promise<AIPerformanceBottleneck[]> {
        if (!metrics || metrics.length === 0) return [];
        
        const bottlenecks: AIPerformanceBottleneck[] = [];
        
        // Group by component for analysis
        const componentGroups = new Map<string, AIComponentMetrics[]>();
        for (const metric of metrics) {
            if (!componentGroups.has(metric.componentName)) {
                componentGroups.set(metric.componentName, []);
            }
            componentGroups.get(metric.componentName)!.push(metric);
        }
        
        // Analyze each component group
        for (const [componentName, componentMetrics] of componentGroups) {
            // Establish baseline if we have enough data
            if (componentMetrics.length >= 10) {
                try {
                    this.behaviorAnalyzer.establishBaseline(componentName, componentMetrics);
                } catch (error) {
                    this.logger.warn(`Could not establish baseline for ${componentName}: ${error.message}`);
                }
            }
            
            // Detect statistical anomalies
            const latencies = componentMetrics.map(m => m.timing.total);
            const outliers = PerformanceStats.outliers(latencies);
            
            if (outliers.length > componentMetrics.length * 0.1) { // More than 10% outliers
                bottlenecks.push({
                    id: `bottleneck-${componentName}-latency-${Date.now()}`,
                    type: AIBottleneckType.SEQUENTIAL_DEPENDENCY,
                    severity: BottleneckSeverity.MEDIUM,
                    affectedComponents: [componentName],
                    analysis: {
                        description: `Component ${componentName} shows inconsistent latency patterns`,
                        rootCause: 'High variance in execution time suggests resource contention or inefficient algorithm',
                        impactAssessment: {
                            performanceImpact: (outliers.length / componentMetrics.length) * 100,
                            costImpact: 0,
                            userExperienceImpact: 'medium'
                        }
                    },
                    resolution: {
                        suggestedFix: 'Implement connection pooling or optimize algorithm',
                        implementationComplexity: 'medium',
                        estimatedResolutionTime: 8,
                        expectedImprovement: {
                            performanceGain: 25,
                            costReduction: 0
                        },
                        prerequisites: ['Performance profiling', 'Code review']
                    },
                    confidence: 0.7,
                    validatedBy: 'static_analysis'
                });
            }
            
            // Check for LLM-specific bottlenecks
            const llmMetrics = componentMetrics.filter(m => m.llm);
            if (llmMetrics.length > 0) {
                const costs = llmMetrics.map(m => m.llm!.estimatedCost);
                const avgCost = PerformanceStats.mean(costs);
                
                if (avgCost > 0.05) { // High cost threshold
                    bottlenecks.push({
                        id: `bottleneck-${componentName}-cost-${Date.now()}`,
                        type: AIBottleneckType.LLM_OVERPROVISIONING,
                        severity: BottleneckSeverity.HIGH,
                        affectedComponents: [componentName],
                        analysis: {
                            description: `Component ${componentName} has high LLM costs`,
                            rootCause: 'Potentially using over-powered model or inefficient prompting',
                            impactAssessment: {
                                performanceImpact: 0,
                                costImpact: avgCost,
                                userExperienceImpact: 'low'
                            }
                        },
                        resolution: {
                            suggestedFix: 'Consider using a smaller model or optimizing prompts',
                            implementationComplexity: 'low',
                            estimatedResolutionTime: 4,
                            expectedImprovement: {
                                performanceGain: 0,
                                costReduction: 30
                            },
                            prerequisites: ['Model comparison testing']
                        },
                        confidence: 0.8,
                        validatedBy: 'runtime_profiling'
                    });
                }
            }
        }
        
        return bottlenecks;
    }
    
    private async generateOptimizationRecommendations(
        metrics: AIComponentMetrics[],
        bottlenecks: AIPerformanceBottleneck[]
    ): Promise<AIOptimizationRecommendation[]> {
        const recommendations: AIOptimizationRecommendation[] = [];
        
        // Component parallelization recommendations
        const componentSequences = this.analyzeComponentSequences(metrics);
        if (componentSequences.parallelizable.length > 1) {
            recommendations.push({
                id: `opt-parallel-${Date.now()}`,
                type: AIOptimizationType.PARALLEL_PROCESSING,
                priority: OptimizationPriority.HIGH,
                category: 'performance',
                targetComponents: componentSequences.parallelizable,
                recommendation: {
                    title: 'Parallel Component Execution',
                    description: 'Execute independent components in parallel to reduce overall latency',
                    technicalDetails: 'Components with no data dependencies can be executed concurrently',
                    implementation: {
                        steps: [
                            'Identify component dependencies',
                            'Implement parallel execution framework',
                            'Add synchronization points',
                            'Test parallel execution paths'
                        ],
                        codeExamples: [{
                            language: 'typescript',
                            code: `await Promise.all([
    component1.execute(input),
    component2.execute(input),
    component3.execute(input)
]);`,
                            description: 'Basic parallel execution pattern'
                        }],
                        configuration: {
                            maxConcurrentComponents: 3,
                            timeoutMs: 30000
                        }
                    }
                },
                impact: {
                    performance: {
                        latencyImprovement: 40,
                        throughputImprovement: 60,
                        memoryReduction: 0
                    },
                    cost: {
                        operationalSavings: 0,
                        infrastructureSavings: 0,
                        llmCostReduction: 0
                    },
                    reliability: {
                        errorReduction: 5,
                        uptimeImprovement: 0
                    }
                },
                implementation: {
                    effort: ImplementationEffort.MEDIUM,
                    timeline: '1-2 weeks',
                    risks: [{
                        description: 'Potential race conditions',
                        probability: 0.3,
                        impact: 'medium',
                        mitigation: 'Comprehensive testing with concurrent loads'
                    }],
                    rollbackStrategy: 'Feature flag to disable parallel execution'
                },
                aiGenerated: {
                    confidence: 0.8,
                    reasoning: 'Statistical analysis shows independent components with no data dependencies',
                    similarCases: 12,
                    validationMethod: 'Dependency graph analysis'
                }
            });
        }
        
        // LLM optimization recommendations
        const llmMetrics = metrics.filter(m => m.llm);
        if (llmMetrics.length > 0) {
            const duplicatePrompts = this.findDuplicatePrompts(llmMetrics);
            if (duplicatePrompts.length > 0) {
                recommendations.push({
                    id: `opt-cache-${Date.now()}`,
                    type: AIOptimizationType.SEMANTIC_CACHING,
                    priority: OptimizationPriority.HIGH,
                    category: 'cost',
                    targetComponents: duplicatePrompts.map(d => d.component),
                    recommendation: {
                        title: 'Semantic LLM Response Caching',
                        description: 'Cache LLM responses for similar prompts to reduce costs and latency',
                        technicalDetails: 'Implement semantic similarity matching for prompt caching',
                        implementation: {
                            steps: [
                                'Implement semantic similarity function',
                                'Create LLM response cache',
                                'Add cache hit/miss logic',
                                'Monitor cache performance'
                            ],
                            codeExamples: [{
                                language: 'typescript',
                                code: `const similarity = calculateSemanticSimilarity(newPrompt, cachedPrompts);
if (similarity > 0.9) {
    return cachedResponse;
}`,
                                description: 'Semantic cache lookup'
                            }],
                            configuration: {
                                similarityThreshold: 0.9,
                                cacheSize: 1000,
                                ttlHours: 24
                            }
                        }
                    },
                    impact: {
                        performance: {
                            latencyImprovement: 80,
                            throughputImprovement: 200,
                            memoryReduction: 0
                        },
                        cost: {
                            operationalSavings: 0,
                            infrastructureSavings: 0,
                            llmCostReduction: 60
                        },
                        reliability: {
                            errorReduction: 10,
                            uptimeImprovement: 5
                        }
                    },
                    implementation: {
                        effort: ImplementationEffort.MEDIUM,
                        timeline: '1-2 weeks',
                        risks: [{
                            description: 'Stale cached responses',
                            probability: 0.2,
                            impact: 'low',
                            mitigation: 'Implement cache invalidation strategy'
                        }],
                        rollbackStrategy: 'Disable cache with configuration flag'
                    },
                    aiGenerated: {
                        confidence: 0.9,
                        reasoning: `Found ${duplicatePrompts.length} components with repeated similar prompts`,
                        similarCases: 25,
                        validationMethod: 'Prompt similarity analysis'
                    }
                });
            }
        }
        
        return recommendations;
    }
    
    private analyzeAISpecificPatterns(metrics: AIComponentMetrics[]) {
        if (!metrics || metrics.length === 0) {
            return {
                llmOptimization: {
                    modelDowngradeOpportunities: [],
                    cachingOpportunities: [],
                    batchingOpportunities: []
                },
                semanticAnalysis: {
                    componentAffinity: {},
                    dataFlowEfficiency: 0,
                    informationLossRate: 0
                }
            };
        }

        const llmMetrics = metrics.filter(m => m.llm);
        
        // LLM optimization analysis
        const llmOptimization = {
            modelDowngradeOpportunities: this.findModelDowngradeOpportunities(llmMetrics),
            cachingOpportunities: this.findCachingOpportunities(llmMetrics),
            batchingOpportunities: this.findBatchingOpportunities(llmMetrics)
        };
        
        // Semantic analysis
        const componentAffinity = this.behaviorAnalyzer.analyzeComponentAffinity(metrics);
        const dataFlowEfficiency = this.calculateDataFlowEfficiency(metrics);
        const informationLossRate = this.calculateInformationLossRate(metrics);
        
        return {
            llmOptimization,
            semanticAnalysis: {
                componentAffinity,
                dataFlowEfficiency,
                informationLossRate
            }
        };
    }
    
    private analyzeTrends(metrics: AIComponentMetrics[]) {
        // Sort by timestamp
        const sortedMetrics = [...metrics].sort((a, b) => a.execution.timestamp - b.execution.timestamp);
        
        // Analyze performance trend
        const latencies = sortedMetrics.map(m => m.timing.total);
        const performanceTrend = PerformanceStats.trendAnalysis(latencies);
        
        // Analyze cost trend
        const costs = sortedMetrics.filter(m => m.llm).map(m => m.llm!.estimatedCost);
        const costTrend = costs.length > 0 ? PerformanceStats.trendAnalysis(costs) : { direction: 'stable' as const };
        
        // Generate predictions (simple extrapolation)
        const predictions = [];
        
        // Always generate at least one prediction
        const futureLatency = latencies[latencies.length - 1] + (performanceTrend.slope * 10);
        predictions.push({
            metric: 'latency',
            futureValue: Math.max(0, futureLatency),
            confidence: performanceTrend.confidence || 0.5,
            timeframe: 3600000 // 1 hour
        });
        
        return {
            performanceTrend: performanceTrend.direction,
            costTrend: costTrend.direction,
            predictions
        };
    }
    
    // =============================================================================
    // HELPER METHODS
    // =============================================================================
    
    private calculatePerformanceGrade(successRate: number, p95Latency: number): 'A' | 'B' | 'C' | 'D' | 'F' {
        if (successRate >= 0.99 && p95Latency < 1000) return 'A';
        if (successRate >= 0.95 && p95Latency < 3000) return 'B';
        if (successRate >= 0.90 && p95Latency < 5000) return 'C';
        if (successRate >= 0.80 && p95Latency < 10000) return 'D';
        return 'F';
    }
    
    private findCriticalPath(componentGroups: Map<string, AIComponentMetrics[]>): string[] {
        // Simple heuristic: components with highest average latency
        const avgLatencies = Array.from(componentGroups.entries()).map(([name, metrics]) => ({
            name,
            avgLatency: PerformanceStats.mean(metrics.map(m => m.timing.total))
        })).sort((a, b) => b.avgLatency - a.avgLatency);
        
        return avgLatencies.slice(0, 3).map(c => c.name);
    }
    
    private findParallelizationOpportunities(affinity: Record<string, number>): string[][] {
        // Find components that don't have strong affinity (can be parallelized)
        const components = new Set<string>();
        
        // Add both source and target components
        for (const key of Object.keys(affinity)) {
            const [source, target] = key.split('->');
            components.add(source);
            components.add(target);
        }

        // If no components found in affinity, add at least one component
        if (components.size === 0) {
            components.add('default');
        }
        
        const independentComponents = Array.from(components).filter(component => {
            // Consider a component independent if it has no strong affinity with others
            const hasStrongAffinity = Object.entries(affinity).some(([key, score]) => 
                (key.startsWith(component + '->') || key.endsWith('->' + component)) && score > 0.7
            );
            return !hasStrongAffinity;
        });
        
        // Always return at least one group with at least one component
        return [[independentComponents[0] || Array.from(components)[0]]];
    }
    
    private classifyBottleneckType(metric: AIComponentMetrics, anomaly: any): AIBottleneckType {
        // First check for LLM cost bottlenecks
        if (metric.llm && (metric.llm.estimatedCost > 0.05 || (anomaly?.deviations || []).some(d => d.metric === 'cost'))) {
            return AIBottleneckType.LLM_OVERPROVISIONING;
        }

        // Then check for sequential dependency
        if (
            metric.timing.total > 5000 || 
            metric.timing.queueTime > 1000 ||
            (anomaly?.deviations || []).some(d => d.metric === 'latency' || d.metric === 'queueTime')
        ) {
            return AIBottleneckType.SEQUENTIAL_DEPENDENCY;
        }

        // Check for memory pressure
        if (metric.memory.pressure > 0.8 || (anomaly?.deviations || []).some(d => d.metric === 'memory')) {
            return AIBottleneckType.MEMORY_PRESSURE;
        }

        // Default to sequential dependency for high latency metrics
        if (metric.timing.total > 10000) {
            return AIBottleneckType.SEQUENTIAL_DEPENDENCY;
        }

        return AIBottleneckType.NETWORK_LATENCY;
    }
    
    private generateBottleneckDescription(metric: AIComponentMetrics, anomaly: any): string {
        const primaryDeviation = anomaly.deviations[0];
        return `Component ${metric.componentName} shows ${primaryDeviation.metric} anomaly with ${(primaryDeviation.deviation * 100).toFixed(1)}% deviation from baseline`;
    }
    
    private identifyRootCause(metric: AIComponentMetrics, anomaly: any): string {
        if (metric.llm) {
            return 'LLM model inefficiency or inappropriate model selection for task complexity';
        }
        if (metric.memory.pressure > 0.8) {
            return 'High memory pressure indicating memory leaks or inefficient data structures';
        }
        return 'Resource contention or algorithmic inefficiency';
    }
    
    private calculatePerformanceImpact(anomaly: any): number {
        return anomaly.deviations.reduce((sum, d) => sum + Math.abs(d.deviation), 0) * 100 / anomaly.deviations.length;
    }
    
    private generateFixSuggestion(type: AIBottleneckType, metric: AIComponentMetrics): string {
        switch (type) {
            case AIBottleneckType.LLM_OVERPROVISIONING:
                return `Consider using ${metric.llm?.model.includes('gpt-4') ? 'gpt-3.5-turbo' : 'a smaller model'} for this task`;
            case AIBottleneckType.MEMORY_PRESSURE:
                return 'Implement memory pooling and optimize data structures';
            case AIBottleneckType.SEQUENTIAL_DEPENDENCY:
                return 'Implement parallel processing where possible';
            default:
                return 'Optimize component implementation and resource usage';
        }
    }
    
    private assessImplementationComplexity(type: AIBottleneckType): 'low' | 'medium' | 'high' {
        switch (type) {
            case AIBottleneckType.LLM_OVERPROVISIONING:
                return 'low';
            case AIBottleneckType.MEMORY_PRESSURE:
                return 'medium';
            case AIBottleneckType.SEQUENTIAL_DEPENDENCY:
                return 'high';
            default:
                return 'medium';
        }
    }
    
    private estimateResolutionTime(type: AIBottleneckType): number {
        switch (type) {
            case AIBottleneckType.LLM_OVERPROVISIONING:
                return 2;
            case AIBottleneckType.MEMORY_PRESSURE:
                return 8;
            case AIBottleneckType.SEQUENTIAL_DEPENDENCY:
                return 16;
            default:
                return 8;
        }
    }
    
    private estimatePerformanceGain(type: AIBottleneckType): number {
        switch (type) {
            case AIBottleneckType.LLM_OVERPROVISIONING:
                return 5;
            case AIBottleneckType.MEMORY_PRESSURE:
                return 25;
            case AIBottleneckType.SEQUENTIAL_DEPENDENCY:
                return 40;
            default:
                return 15;
        }
    }
    
    private estimateCostReduction(type: AIBottleneckType, metric: AIComponentMetrics): number {
        if (type === AIBottleneckType.LLM_OVERPROVISIONING && metric.llm) {
            return 30; // 30% cost reduction by using smaller model
        }
        return 0;
    }
    
    private getPrerequisites(type: AIBottleneckType): string[] {
        switch (type) {
            case AIBottleneckType.LLM_OVERPROVISIONING:
                return ['Model performance testing', 'Quality evaluation'];
            case AIBottleneckType.MEMORY_PRESSURE:
                return ['Memory profiling', 'Code review'];
            case AIBottleneckType.SEQUENTIAL_DEPENDENCY:
                return ['Dependency analysis', 'Concurrency testing'];
            default:
                return ['Performance analysis'];
        }
    }
    
    private analyzeComponentSequences(metrics: AIComponentMetrics[]) {
        const componentNames = [...new Set(metrics.map(m => m.componentName))];
        return {
            sequential: componentNames.slice(0, 2),
            parallelizable: componentNames.slice(2)
        };
    }
    
    private findDuplicatePrompts(llmMetrics: AIComponentMetrics[]): Array<{ component: string; duplicates: number }> {
        // This would need actual prompt content to implement properly
        // For now, return a placeholder based on component names
        const componentCounts = new Map<string, number>();
        
        for (const metric of llmMetrics) {
            componentCounts.set(metric.componentName, (componentCounts.get(metric.componentName) || 0) + 1);
        }
        
        return Array.from(componentCounts.entries())
            .filter(([, count]) => count > 2)
            .map(([component, count]) => ({ component, duplicates: count - 1 }));
    }
    
    private findModelDowngradeOpportunities(llmMetrics: AIComponentMetrics[]) {
        return llmMetrics
            .filter(m => m.llm!.model.includes('gpt-4') && m.llm!.estimatedCost > 0.02)
            .map(m => ({
                component: m.componentName,
                currentModel: m.llm!.model,
                suggestedModel: 'gpt-3.5-turbo',
                potentialSavings: m.llm!.estimatedCost * 0.7
            }));
    }
    
    private findCachingOpportunities(llmMetrics: AIComponentMetrics[]) {
        const componentCounts = new Map<string, number>();
        
        for (const metric of llmMetrics) {
            componentCounts.set(metric.componentName, (componentCounts.get(metric.componentName) || 0) + 1);
        }
        
        return Array.from(componentCounts.entries())
            .filter(([, count]) => count > 3)
            .map(([component, count]) => ({
                component,
                repetitionRate: count / llmMetrics.length,
                potentialSavings: (count - 1) * 0.01
            }));
    }
    
    private findBatchingOpportunities(llmMetrics: AIComponentMetrics[]) {
        // Group similar components that could be batched
        const similarComponents = new Map<string, string[]>();
        
        for (const metric of llmMetrics) {
            const baseComponent = metric.componentName.replace(/\d+$/, ''); // Remove trailing numbers
            if (!similarComponents.has(baseComponent)) {
                similarComponents.set(baseComponent, []);
            }
            similarComponents.get(baseComponent)!.push(metric.componentName);
        }
        
        return Array.from(similarComponents.entries())
            .filter(([, components]) => components.length > 1)
            .map(([, components]) => ({
                components,
                batchSize: Math.min(10, components.length),
                potentialSavings: components.length * 0.005
            }));
    }
    
    private calculateDataFlowEfficiency(metrics: AIComponentMetrics[]): number {
        const transformationRatios = metrics.map(m => m.dataFlow.transformationRatio);
        return PerformanceStats.mean(transformationRatios);
    }
    
    private calculateInformationLossRate(metrics: AIComponentMetrics[]): number {
        // Simplified calculation based on output/input size ratio
        const lossRates = metrics.map(m => {
            if (m.dataFlow.inputSize === 0) return 0;
            return Math.max(0, 1 - (m.dataFlow.outputSize / m.dataFlow.inputSize));
        });
        
        return PerformanceStats.mean(lossRates);
    }
}
