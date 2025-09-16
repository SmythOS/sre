import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { Component } from '@sre/Components/Component.class';
import { AIPerformanceCollector, DEFAULT_AI_PERFORMANCE_CONFIG } from '@sre/helpers/AIPerformanceCollector.helper';
import { Agent } from '@sre/subsystems/AgentManager/Agent.class';
import { AIPerformanceEventType } from '@sre/types/Performance.types';

class TestComponent extends Component {
    protected async doProcess(input: any, config: any, agent: Agent): Promise<any> {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: 'success' };
    }
}

describe('Component Performance Monitoring Integration', () => {
    let component: TestComponent;
    let agent: Agent;
    let collector: AIPerformanceCollector;

    beforeEach(() => {
        component = new TestComponent();
        agent = new Agent({ id: 'test-agent' });
        Component.initializePerformanceMonitoring();
        collector = AIPerformanceCollector.getInstance(DEFAULT_AI_PERFORMANCE_CONFIG);
    });

    afterEach(() => {
        Component.disablePerformanceMonitoring();
    });

    test('should track component execution metrics', async () => {
        const events: any[] = [];
        collector.on('performance-event', (event) => {
            events.push(event);
        });

        await component.process(
            { input: 'test' },
            { name: 'TestComponent' },
            agent
        );

        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0].type).toBe(AIPerformanceEventType.COMPONENT_START);
        expect(events[1].type).toBe(AIPerformanceEventType.COMPONENT_END);
    });

    test('should track LLM-specific metrics', async () => {
        const events: any[] = [];
        collector.on('performance-event', (event) => {
            if (event.type === AIPerformanceEventType.COMPONENT_END) {
                events.push(event);
            }
        });

        class LLMComponent extends Component {
            protected async doProcess(input: any, config: any, agent: Agent): Promise<any> {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    result: 'success',
                    usage: {
                        prompt_tokens: 100,
                        completion_tokens: 50
                    },
                    model: 'gpt-4'
                };
            }
        }

        const llmComponent = new LLMComponent();
        await llmComponent.process(
            { input: 'test' },
            { name: 'LLMComponent' },
            agent
        );

        const metrics = events[0].payload.metric;
        expect(metrics.llm).toBeDefined();
        expect(metrics.llm.tokens.total).toBe(150);
        expect(metrics.llm.model).toBe('gpt-4');
    });

    test('should respect sampling configuration', async () => {
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

        const events: any[] = [];
        collector.on('performance-event', (event) => {
            events.push(event);
        });

        await component.process(
            { input: 'test' },
            { name: 'TestComponent' },
            agent
        );

        expect(events.length).toBe(0);
    });

    test('should handle component errors gracefully', async () => {
        class ErrorComponent extends Component {
            protected async doProcess(): Promise<any> {
                throw new Error('Test error');
            }
        }

        const errorComponent = new ErrorComponent();
        const events: any[] = [];
        collector.on('performance-event', (event) => {
            if (event.type === AIPerformanceEventType.COMPONENT_END) {
                events.push(event);
            }
        });

        await expect(
            errorComponent.process(
                { input: 'test' },
                { name: 'ErrorComponent' },
                agent
            )
        ).rejects.toThrow('Test error');

        const metrics = events[0].payload.metric;
        expect(metrics.execution.success).toBe(false);
        expect(metrics.execution.errorType).toBe('Error');
    });

    test('should track memory usage', async () => {
        class MemoryIntensiveComponent extends Component {
            protected async doProcess(): Promise<any> {
                // Allocate some memory
                const array = new Array(1000000).fill(0);
                await new Promise(resolve => setTimeout(resolve, 100));
                return { result: array.length };
            }
        }

        const memoryComponent = new MemoryIntensiveComponent();
        const events: any[] = [];
        collector.on('performance-event', (event) => {
            if (event.type === AIPerformanceEventType.COMPONENT_END) {
                events.push(event);
            }
        });

        await memoryComponent.process(
            { input: 'test' },
            { name: 'MemoryComponent' },
            agent
        );

        const metrics = events[0].payload.metric;
        expect(metrics.memory.delta).toBeGreaterThan(0);
        expect(metrics.memory.peak).toBeGreaterThan(0);
        expect(metrics.memory.pressure).toBeGreaterThanOrEqual(0);
        expect(metrics.memory.pressure).toBeLessThanOrEqual(1);
    });

    test('should track data flow metrics', async () => {
        class DataFlowComponent extends Component {
            protected async doProcess(input: any): Promise<any> {
                // Transform input data
                const result = input.data.map((x: number) => x * 2);
                await new Promise(resolve => setTimeout(resolve, 100));
                return { result };
            }
        }

        const dataComponent = new DataFlowComponent();
        const events: any[] = [];
        collector.on('performance-event', (event) => {
            if (event.type === AIPerformanceEventType.COMPONENT_END) {
                events.push(event);
            }
        });

        await dataComponent.process(
            { data: [1, 2, 3, 4, 5] },
            { name: 'DataFlowComponent' },
            agent
        );

        const metrics = events[0].payload.metric;
        expect(metrics.dataFlow.inputSize).toBeGreaterThan(0);
        expect(metrics.dataFlow.outputSize).toBeGreaterThan(0);
        expect(metrics.dataFlow.transformationRatio).toBeGreaterThan(0);
        expect(metrics.dataFlow.complexityScore).toBeGreaterThanOrEqual(0);
        expect(metrics.dataFlow.complexityScore).toBeLessThanOrEqual(1);
    });
});
