import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AIPerformanceCollector, DEFAULT_AI_PERFORMANCE_CONFIG, AIPerformanceTimer } from '@sre/helpers/AIPerformanceCollector.helper';
import { AIPerformanceEventType } from '@sre/types/Performance.types';

describe('AIPerformanceCollector', () => {
    let collector: AIPerformanceCollector;

    beforeEach(() => {
        collector = AIPerformanceCollector.getInstance(DEFAULT_AI_PERFORMANCE_CONFIG);
    });

    afterEach(() => {
        collector.shutdown();
    });

    test('should initialize with default config', () => {
        expect(collector).toBeDefined();
        expect(collector).toBeInstanceOf(AIPerformanceCollector);
    });

    test('should maintain singleton instance', () => {
        const anotherCollector = AIPerformanceCollector.getInstance();
        expect(anotherCollector).toBe(collector);
    });

    test('should start component execution timer', () => {
        const timer = collector.startComponentExecution(
            'TestComponent',
            'test-agent',
            { name: 'test' }
        );

        expect(timer).toBeDefined();
        expect(timer).toBeInstanceOf(AIPerformanceTimer);
    });

    test('should record component metrics', () => {
        const timer = collector.startComponentExecution(
            'TestComponent',
            'test-agent',
            { name: 'test' }
        );

        const metrics = timer!.finish(
            { input: 'test' },
            { output: 'test' },
            true
        );

        collector.recordMetrics('test-agent', metrics);

        const agentMetrics = collector.getAgentMetrics('test-agent');
        expect(agentMetrics).toHaveLength(1);
        expect(agentMetrics[0].componentName).toBe('TestComponent');
    });

    test('should emit performance events', (done) => {
        collector.on('performance-event', (event) => {
            expect(event.type).toBe(AIPerformanceEventType.COMPONENT_START);
            expect(event.source.agentId).toBe('test-agent');
            done();
        });

        collector.startComponentExecution(
            'TestComponent',
            'test-agent',
            { name: 'test' }
        );
    });

    test('should handle batch flushes', (done) => {
        collector.on('batch-flush', (events) => {
            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThan(0);
            done();
        });

        // Generate some events
        for (let i = 0; i < 5; i++) {
            const timer = collector.startComponentExecution(
                'TestComponent',
                'test-agent',
                { name: 'test' }
            );
            const metrics = timer!.finish(
                { input: 'test' },
                { output: 'test' },
                true
            );
            collector.recordMetrics('test-agent', metrics);
        }
    });

    test('should respect sampling rates', () => {
        const customConfig = {
            ...DEFAULT_AI_PERFORMANCE_CONFIG,
            components: {
                ...DEFAULT_AI_PERFORMANCE_CONFIG.components,
                customSamplingRates: {
                    'TestComponent': 0 // Never sample
                }
            }
        };

        collector.updateConfig(customConfig);

        const timer = collector.startComponentExecution(
            'TestComponent',
            'test-agent',
            { name: 'test' }
        );

        expect(timer).toBeNull();
    });

    test('should track LLM metrics', () => {
        const timer = collector.startComponentExecution(
            'LLMAssistant',
            'test-agent',
            { name: 'test' }
        );

        timer!.trackLLM({
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            estimatedCost: 0.01,
            contextUtilization: 0.5
        });

        const metrics = timer!.finish(
            { input: 'test' },
            { output: 'test' },
            true
        );

        expect(metrics.llm).toBeDefined();
        expect(metrics.llm!.model).toBe('gpt-4');
        expect(metrics.llm!.tokens.total).toBe(150);
    });

    test('should enforce buffer size limits', () => {
        const smallConfig = {
            ...DEFAULT_AI_PERFORMANCE_CONFIG,
            global: {
                ...DEFAULT_AI_PERFORMANCE_CONFIG.global,
                bufferSize: 2
            }
        };

        collector.updateConfig(smallConfig);

        // Record 3 metrics
        for (let i = 0; i < 3; i++) {
            const timer = collector.startComponentExecution(
                'TestComponent',
                'test-agent',
                { name: 'test' }
            );
            const metrics = timer!.finish(
                { input: 'test' },
                { output: 'test' },
                true
            );
            collector.recordMetrics('test-agent', metrics);
        }

        const agentMetrics = collector.getAgentMetrics('test-agent');
        expect(agentMetrics.length).toBeLessThanOrEqual(2);
    });

    test('should export metrics in different formats', () => {
        const timer = collector.startComponentExecution(
            'TestComponent',
            'test-agent',
            { name: 'test' }
        );
        const metrics = timer!.finish(
            { input: 'test' },
            { output: 'test' },
            true
        );
        collector.recordMetrics('test-agent', metrics);

        const jsonExport = collector.exportMetrics('json');
        expect(JSON.parse(jsonExport)).toBeDefined();

        const prometheusExport = collector.exportMetrics('prometheus');
        expect(prometheusExport).toContain('component_execution_time_seconds');

        const csvExport = collector.exportMetrics('csv');
        expect(csvExport).toContain('timestamp,agentId,componentName');
    });
});
