import { describe, test, expect, beforeEach } from 'vitest';
import { LocalPerformanceConnector } from '@sre/subsystems/PerformanceManager/Performance.service/connectors/LocalPerformanceConnector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessRole } from '@sre/types/ACL.types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Performance Metrics Export Integration', () => {
    let connector: LocalPerformanceConnector;
    let agentCandidate: AccessCandidate;
    let testDataDir: string;

    beforeEach(async () => {
        testDataDir = path.join(os.tmpdir(), 'sre-performance-test-' + Date.now());
        await fs.mkdir(testDataDir, { recursive: true });

        connector = new LocalPerformanceConnector({
            dataDir: testDataDir
        });

        agentCandidate = new AccessCandidate({ id: 'test-agent', role: TAccessRole.Agent });
        await connector.start();

        // Load sample data
        const sampleMetrics = JSON.parse(
            await fs.readFile(
                path.join(__dirname, '../../data/performance/sample_metrics.json'),
                'utf8'
            )
        );

        const requester = connector.requester(agentCandidate);
        await requester.storeMetrics(sampleMetrics.metrics);
    });

    test('should export metrics in JSON format', async () => {
        const requester = connector.requester(agentCandidate);
        const jsonExport = await requester.exportMetrics('json');
        const parsed = JSON.parse(jsonExport);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].componentName).toBeDefined();
        expect(parsed[0].timing).toBeDefined();
        expect(parsed[0].memory).toBeDefined();
    });

    test('should export metrics in Prometheus format', async () => {
        const requester = connector.requester(agentCandidate);
        const prometheusExport = await requester.exportMetrics('prometheus');

        expect(prometheusExport).toContain('# HELP');
        expect(prometheusExport).toContain('# TYPE');
        expect(prometheusExport).toContain('component_execution_time_seconds');
        expect(prometheusExport).toContain('component="LLMAssistant"');
    });

    test('should export metrics in CSV format', async () => {
        const requester = connector.requester(agentCandidate);
        const csvExport = await requester.exportMetrics('csv');
        const lines = csvExport.split('\n');

        expect(lines.length).toBeGreaterThan(1);
        expect(lines[0]).toContain('timestamp');
        expect(lines[0]).toContain('agentId');
        expect(lines[0]).toContain('componentName');
        expect(lines[1]).toBeDefined();
    });

    test('should validate export format', async () => {
        const requester = connector.requester(agentCandidate);
        // @ts-expect-error - Testing invalid format
        await expect(requester.exportMetrics('invalid')).rejects.toThrow();
    });

    test('should handle empty metrics gracefully', async () => {
        const requester = connector.requester(agentCandidate);
        await requester.clearMetrics();

        const jsonExport = await requester.exportMetrics('json');
        const parsed = JSON.parse(jsonExport);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(0);

        const prometheusExport = await requester.exportMetrics('prometheus');
        expect(prometheusExport).toContain('# HELP');
        expect(prometheusExport).toContain('# TYPE');

        const csvExport = await requester.exportMetrics('csv');
        const lines = csvExport.split('\n');
        expect(lines[0]).toContain('timestamp');
        expect(lines.length).toBe(1);
    });

    test('should include LLM metrics in exports', async () => {
        const requester = connector.requester(agentCandidate);
        const jsonExport = await requester.exportMetrics('json');
        const parsed = JSON.parse(jsonExport);

        const llmMetrics = parsed.find((m: any) => m.llm);
        expect(llmMetrics).toBeDefined();
        expect(llmMetrics.llm.model).toBe('gpt-4');
        expect(llmMetrics.llm.tokens).toBeDefined();
        expect(llmMetrics.llm.estimatedCost).toBeGreaterThan(0);
    });

    test('should handle large metric sets', async () => {
        const requester = connector.requester(agentCandidate);
        
        // Generate large set of metrics
        const largeMetrics = Array(1000).fill(null).map((_, i) => ({
            componentName: 'TestComponent',
            agentId: 'test-agent',
            timing: {
                total: 100 + Math.random() * 100,
                inputProcessing: 10,
                coreProcessing: 80,
                outputProcessing: 10,
                queueTime: 0
            },
            memory: {
                peak: 1000000,
                delta: 100000,
                pressure: 0.5
            },
            dataFlow: {
                inputSize: 1000,
                outputSize: 500,
                transformationRatio: 0.5,
                complexityScore: 0.5
            },
            execution: {
                timestamp: Date.now() + i * 1000,
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
        }));

        await requester.storeMetrics(largeMetrics);

        const jsonExport = await requester.exportMetrics('json');
        const prometheusExport = await requester.exportMetrics('prometheus');
        const csvExport = await requester.exportMetrics('csv');

        expect(JSON.parse(jsonExport).length).toBe(1000);
        expect(prometheusExport.split('\n').length).toBeGreaterThan(1000);
        expect(csvExport.split('\n').length).toBe(1001); // Including header
    });

    test('should maintain data consistency across formats', async () => {
        const requester = connector.requester(agentCandidate);
        
        const jsonExport = await requester.exportMetrics('json');
        const csvExport = await requester.exportMetrics('csv');
        
        const jsonMetrics = JSON.parse(jsonExport);
        const csvLines = csvExport.split('\n').slice(1); // Skip header

        expect(jsonMetrics.length).toBe(csvLines.length);

        // Compare first metric
        const jsonFirst = jsonMetrics[0];
        const csvFirst = csvLines[0].split(',');
        
        expect(csvFirst[1]).toBe(jsonFirst.agentId);
        expect(csvFirst[2]).toBe(jsonFirst.componentName);
    });
});
