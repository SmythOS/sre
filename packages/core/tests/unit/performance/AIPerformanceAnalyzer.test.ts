import { describe, test, expect, beforeEach } from 'vitest';
import { AIPerformanceAnalyzer } from '@sre/helpers/AIPerformanceAnalyzer.helper';
import { AIComponentMetrics, AIBottleneckType, BottleneckSeverity } from '@sre/types/Performance.types';

describe('AIPerformanceAnalyzer', () => {
    let analyzer: AIPerformanceAnalyzer;
    let sampleMetrics: AIComponentMetrics[];

    beforeEach(() => {
        analyzer = new AIPerformanceAnalyzer();
        sampleMetrics = [
            {
                componentName: 'LLMAssistant',
                agentId: 'test-agent',
                timing: {
                    total: 1500,
                    inputProcessing: 100,
                    coreProcessing: 1300,
                    outputProcessing: 100,
                    queueTime: 50
                },
                memory: {
                    peak: 1024 * 1024 * 50,
                    delta: 1024 * 1024 * 10,
                    pressure: 0.5
                },
                dataFlow: {
                    inputSize: 1000,
                    outputSize: 500,
                    transformationRatio: 0.5,
                    complexityScore: 0.7
                },
                llm: {
                    model: 'gpt-4',
                    tokens: {
                        prompt: 500,
                        completion: 200,
                        total: 700
                    },
                    estimatedCost: 0.02,
                    contextUtilization: 0.6,
                    qualityScore: 0.8
                },
                execution: {
                    timestamp: Date.now(),
                    success: true,
                    retryCount: 0,
                    configHash: 'abc123'
                },
                impact: {
                    cpuUsage: 30,
                    ioOperations: 5,
                    networkRequests: 2,
                    cacheStatus: 'miss'
                }
            }
        ];
    });

    test('should analyze agent performance', async () => {
        const report = await analyzer.analyzeAgentPerformance(
            'test-agent',
            'Test Agent',
            sampleMetrics
        );

        expect(report).toBeDefined();
        expect(report.metadata.agentId).toBe('test-agent');
        expect(report.metadata.agentName).toBe('Test Agent');
        expect(report.summary.totalLLMCosts).toBeGreaterThan(0);
        expect(report.summary.successRate).toBe(1);
    });

    test('should detect real-time bottlenecks', async () => {
        const highLatencyMetric: AIComponentMetrics = {
            ...sampleMetrics[0],
            timing: {
                ...sampleMetrics[0].timing,
                total: 10000 // 10 seconds
            }
        };

        const bottleneck = await analyzer.detectRealTimeBottleneck(highLatencyMetric);

        expect(bottleneck).toBeDefined();
        expect(bottleneck?.type).toBe(AIBottleneckType.SEQUENTIAL_DEPENDENCY);
        expect(bottleneck?.severity).toBe(BottleneckSeverity.HIGH);
    });

    test('should identify LLM cost bottlenecks', async () => {
        const highCostMetric: AIComponentMetrics = {
            ...sampleMetrics[0],
            llm: {
                ...sampleMetrics[0].llm!,
                estimatedCost: 0.15 // High cost
            }
        };

        const bottleneck = await analyzer.detectRealTimeBottleneck(highCostMetric);

        expect(bottleneck).toBeDefined();
        expect(bottleneck?.type).toBe(AIBottleneckType.LLM_OVERPROVISIONING);
        expect(bottleneck?.resolution.suggestedFix).toContain('gpt-3.5-turbo');
    });

    test('should analyze component performance trends', async () => {
        const report = await analyzer.analyzeAgentPerformance(
            'test-agent',
            'Test Agent',
            Array(10).fill(sampleMetrics[0])
        );

        expect(report.trends).toBeDefined();
        expect(report.trends.performanceTrend).toBeDefined();
        expect(report.trends.costTrend).toBeDefined();
        expect(report.trends.predictions).toHaveLength(1);
    });

    test('should generate optimization recommendations', async () => {
        const report = await analyzer.analyzeAgentPerformance(
            'test-agent',
            'Test Agent',
            Array(10).fill(sampleMetrics[0])
        );

        expect(report.recommendations).toBeDefined();
        expect(report.recommendations.length).toBeGreaterThan(0);
        expect(report.recommendations[0].implementation.effort).toBeDefined();
        expect(report.recommendations[0].impact).toBeDefined();
    });

    test('should handle empty metrics gracefully', async () => {
        await expect(
            analyzer.analyzeAgentPerformance('test-agent', 'Test Agent', [])
        ).rejects.toThrow('No metrics available for analysis');
    });

    test('should analyze AI-specific patterns', async () => {
        const report = await analyzer.analyzeAgentPerformance(
            'test-agent',
            'Test Agent',
            sampleMetrics
        );

        expect(report.aiInsights).toBeDefined();
        expect(report.aiInsights.llmOptimization).toBeDefined();
        expect(report.aiInsights.semanticAnalysis).toBeDefined();
    });
});
