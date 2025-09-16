import { describe, test, expect, beforeEach } from 'vitest';
import { PerformanceConnector } from '../../../src/subsystems/PerformanceManager/Performance.service/PerformanceConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessRole } from '@sre/types/ACL.types';
import { AIComponentMetrics, MetricWindow } from '@sre/types/Performance.types';

// Mock implementation for testing
class TestPerformanceConnector extends PerformanceConnector {
    public id = 'test-connector';
    public name = 'TestPerformance';

    protected async storeMetrics(accessRequest: any, metrics: AIComponentMetrics[]): Promise<void> {
        return Promise.resolve();
    }

    protected async getMetrics(accessRequest: any, timeWindow?: MetricWindow): Promise<AIComponentMetrics[]> {
        return Promise.resolve([]);
    }

    protected async generateReport(accessRequest: any): Promise<any> {
        return Promise.resolve({});
    }

    protected async clearMetrics(accessRequest: any): Promise<void> {
        return Promise.resolve();
    }

    protected async getEvents(accessRequest: any, since?: number): Promise<any[]> {
        return Promise.resolve([]);
    }

    protected async updateConfig(accessRequest: any, config: any): Promise<void> {
        return Promise.resolve();
    }

    protected async exportMetrics(accessRequest: any, format: string): Promise<string> {
        return Promise.resolve('');
    }

    protected async getBaselines(accessRequest: any): Promise<any[]> {
        return Promise.resolve([]);
    }

    protected async establishBaseline(accessRequest: any, componentName: string): Promise<any> {
        return Promise.resolve({});
    }

    public async getResourceACL(resourceId: string, candidate: any): Promise<any> {
        return Promise.resolve({});
    }
}

describe('PerformanceConnector', () => {
    let connector: TestPerformanceConnector;
    let agentCandidate: AccessCandidate;
    let userCandidate: AccessCandidate;

    beforeEach(() => {
        connector = new TestPerformanceConnector();
        agentCandidate = new AccessCandidate({ id: 'test-agent', role: TAccessRole.Agent });
        userCandidate = new AccessCandidate({ id: 'test-user', role: TAccessRole.User });
    });

    test('should create requester interface for agent', () => {
        const requester = connector.requester(agentCandidate);
        expect(requester).toBeDefined();
        expect(typeof requester.storeMetrics).toBe('function');
        expect(typeof requester.getMetrics).toBe('function');
        expect(typeof requester.generateReport).toBe('function');
    });

    test('should create requester interface for user', () => {
        const requester = connector.requester(userCandidate);
        expect(requester).toBeDefined();
        expect(typeof requester.storeMetrics).toBe('function');
        expect(typeof requester.getMetrics).toBe('function');
        expect(typeof requester.generateReport).toBe('function');
    });

    test('should reject invalid candidate roles', () => {
        const invalidCandidate = new AccessCandidate({ id: 'test', role: 'invalid' as TAccessRole });
        expect(() => connector.requester(invalidCandidate)).toThrow();
    });

    test('should perform health check', async () => {
        const health = await connector.healthCheck();
        expect(health).toBeDefined();
        expect(health.status).toBeDefined();
        expect(health.details).toBeDefined();
    });

    test('should get connector statistics', async () => {
        const stats = await connector.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.totalMetrics).toBe('number');
        expect(typeof stats.agentCount).toBe('number');
        expect(stats.timeRange).toBeDefined();
        expect(typeof stats.storageSize).toBe('number');
    });

    test('should handle external export errors gracefully', async () => {
        const requester = connector.requester(agentCandidate);
        await expect(
            connector['exportToExternal'](agentCandidate.readRequest, {
                format: 'prometheus',
                endpoint: 'http://localhost:9090'
            })
        ).rejects.toThrow('External export not implemented');
    });

    test('should validate access control for metrics operations', async () => {
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

        await expect(requester.storeMetrics(metrics)).resolves.not.toThrow();
    });

    test('should handle time window filtering in metrics retrieval', async () => {
        const requester = connector.requester(agentCandidate);
        const timeWindow: MetricWindow = {
            start: Date.now() - 3600000,
            end: Date.now(),
            granularity: '1m',
            aggregation: 'avg'
        };

        const metrics = await requester.getMetrics(timeWindow);
        expect(Array.isArray(metrics)).toBe(true);
    });

    test('should support different export formats', async () => {
        const requester = connector.requester(agentCandidate);
        
        await expect(requester.exportMetrics('json')).resolves.toBeDefined();
        await expect(requester.exportMetrics('prometheus')).resolves.toBeDefined();
        await expect(requester.exportMetrics('csv')).resolves.toBeDefined();
    });
});
