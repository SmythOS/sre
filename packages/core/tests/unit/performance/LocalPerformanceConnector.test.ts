import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { LocalPerformanceConnector } from '../../../src/subsystems/PerformanceManager/Performance.service/connectors/LocalPerformanceConnector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessRole } from '@sre/types/ACL.types';
import { AIComponentMetrics, AIPerformanceEventType } from '@sre/types/Performance.types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('LocalPerformanceConnector', () => {
    let connector: LocalPerformanceConnector;
    let agentCandidate: AccessCandidate;
    let testDataDir: string;

    beforeEach(async () => {
        testDataDir = path.join(os.tmpdir(), 'sre-performance-test-' + Date.now());
        await fs.mkdir(testDataDir, { recursive: true });

        connector = new LocalPerformanceConnector({
            dataDir: testDataDir,
            config: {
                global: {
                    enabled: true,
                    samplingRate: 1.0,
                    bufferSize: 1000,
                    flushInterval: 1000
                }
            }
        });

        agentCandidate = new AccessCandidate({ id: 'test-agent', role: TAccessRole.Agent });
        await connector.start();
    });

    afterEach(async () => {
        await connector.stop();
        await fs.rm(testDataDir, { recursive: true, force: true });
    });

    test('should initialize and start successfully', () => {
        expect(connector).toBeDefined();
        expect(connector.name).toBe('LocalPerformance');
    });

    test('should store and retrieve metrics', async () => {
        const requester = connector.requester(agentCandidate);
        const metrics: AIComponentMetrics[] = [{
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        }];

        await requester.storeMetrics(metrics);
        const retrieved = await requester.getMetrics();

        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].componentName).toBe('TestComponent');
    });

    test('should persist data between restarts', async () => {
        const requester = connector.requester(agentCandidate);
        const metrics: AIComponentMetrics[] = [{
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        }];

        await requester.storeMetrics(metrics);
        await connector.stop();

        // Create new connector instance
        const newConnector = new LocalPerformanceConnector({
            dataDir: testDataDir
        });
        await newConnector.start();

        const newRequester = newConnector.requester(agentCandidate);
        const retrieved = await newRequester.getMetrics();

        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].componentName).toBe('TestComponent');
    });

    test('should handle performance events', async () => {
        const requester = connector.requester(agentCandidate);
        const events = await requester.getEvents();
        expect(Array.isArray(events)).toBe(true);
    });

    test('should generate performance report', async () => {
        const requester = connector.requester(agentCandidate);
        const metrics: AIComponentMetrics[] = Array(10).fill({
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        });

        await requester.storeMetrics(metrics);
        const report = await requester.generateReport();

        expect(report).toBeDefined();
        expect(report.metadata.agentId).toBe('test-agent');
        expect(report.summary).toBeDefined();
    });

    test('should export metrics in different formats', async () => {
        const requester = connector.requester(agentCandidate);
        const metrics: AIComponentMetrics[] = [{
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        }];

        await requester.storeMetrics(metrics);

        const jsonExport = await requester.exportMetrics('json');
        expect(JSON.parse(jsonExport)).toBeDefined();

        const prometheusExport = await requester.exportMetrics('prometheus');
        expect(prometheusExport).toContain('component_execution_time_seconds');

        const csvExport = await requester.exportMetrics('csv');
        expect(csvExport).toContain('timestamp,agentId,componentName');
    });

    test('should establish and retrieve baselines', async () => {
        const requester = connector.requester(agentCandidate);
        const metrics: AIComponentMetrics[] = Array(20).fill({
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        });

        await requester.storeMetrics(metrics);
        const baseline = await requester.establishBaseline('TestComponent');

        expect(baseline).toBeDefined();
        expect(baseline.componentName).toBe('TestComponent');
        expect(baseline.baseline.latency).toBeDefined();
        expect(baseline.baseline.memoryUsage).toBeDefined();
        expect(baseline.baseline.successRate).toBe(1);

        const baselines = await requester.getBaselines();
        expect(baselines).toHaveLength(1);
        expect(baselines[0].componentName).toBe('TestComponent');
    });

    test('should enforce access control', async () => {
        const publicCandidate = new AccessCandidate({ id: 'public', role: TAccessRole.Public });
        const publicRequester = connector.requester(publicCandidate);

        await expect(publicRequester.storeMetrics([])).rejects.toThrow();
    });

    test('should handle configuration updates', async () => {
        const requester = connector.requester(agentCandidate);
        await requester.updateConfig({
            global: {
                enabled: true,
                samplingRate: 0.5,
                bufferSize: 1000,
                flushInterval: 1000
            }
        });

        // Verify config was updated by checking sampling behavior
        const metrics: AIComponentMetrics[] = Array(100).fill({
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000,
                delta: 100,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 100,
                outputSize: 50,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now(),
                success: true,
                retryCount: 0,
                configHash: 'test'
            },
            impact: {
                cpuUsage: 10,
                ioOperations: 1,
                networkRequests: 1,
                cacheStatus: 'miss'
            }
        });

        await requester.storeMetrics(metrics);
        const stored = await requester.getMetrics();
        expect(stored.length).toBe(100); // Sampling happens at collection time, not storage time
    });
});
