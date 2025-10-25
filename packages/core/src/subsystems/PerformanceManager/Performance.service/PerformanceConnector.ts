import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import {
    AIComponentMetrics,
    AIAgentPerformanceReport,
    AIPerformanceEvent,
    AIPerformanceConfig,
    MetricWindow,
    ComponentBaseline,
    ExternalMonitoringExport
} from '@sre/types/Performance.types';

/**
 * Performance request interface for secure access
 */
export interface IPerformanceRequest {
    /** Store performance metrics for an agent */
    storeMetrics(metrics: AIComponentMetrics[]): Promise<void>;
    
    /** Retrieve metrics within a time window */
    getMetrics(timeWindow?: MetricWindow): Promise<AIComponentMetrics[]>;
    
    /** Generate comprehensive performance report */
    generateReport(): Promise<AIAgentPerformanceReport>;
    
    /** Clear stored metrics */
    clearMetrics(): Promise<void>;
    
    /** Get real-time performance events */
    getEvents(since?: number): Promise<AIPerformanceEvent[]>;
    
    /** Update performance monitoring configuration */
    updateConfig(config: Partial<AIPerformanceConfig>): Promise<void>;
    
    /** Export metrics in various formats */
    exportMetrics(format: 'json' | 'prometheus' | 'csv'): Promise<string>;
    
    /** Get component performance baselines */
    getBaselines(): Promise<ComponentBaseline[]>;
    
    /** Establish baseline for specific component */
    establishBaseline(componentName: string): Promise<ComponentBaseline>;
}

/**
 * Abstract base class for performance connectors
 */
export abstract class PerformanceConnector extends SecureConnector {
    public abstract id: string;
    
    /**
     * Get ACL for performance resources
     */
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    
    /**
     * Create secure requester interface scoped to access candidate
     */
    public requester(candidate: AccessCandidate): IPerformanceRequest {
        if (candidate.role !== TAccessRole.Agent && candidate.role !== TAccessRole.User) {
            throw new Error('Only agents and users can access performance monitoring');
        }
        
        return {
            storeMetrics: async (metrics: AIComponentMetrics[]) => {
                return await this.storeMetrics(candidate.writeRequest, metrics);
            },
            
            getMetrics: async (timeWindow?: MetricWindow) => {
                return await this.getMetrics(candidate.readRequest, timeWindow);
            },
            
            generateReport: async () => {
                return await this.generateReport(candidate.readRequest);
            },
            
            clearMetrics: async () => {
                return await this.clearMetrics(candidate.writeRequest);
            },
            
            getEvents: async (since?: number) => {
                return await this.getEvents(candidate.readRequest, since);
            },
            
            updateConfig: async (config: Partial<AIPerformanceConfig>) => {
                return await this.updateConfig(candidate.writeRequest, config);
            },
            
            exportMetrics: async (format: 'json' | 'prometheus' | 'csv') => {
                return await this.exportMetrics(candidate.readRequest, format);
            },
            
            getBaselines: async () => {
                return await this.getBaselines(candidate.readRequest);
            },
            
            establishBaseline: async (componentName: string) => {
                return await this.establishBaseline(candidate.writeRequest, componentName);
            }
        };
    }
    
    // =============================================================================
    // ABSTRACT METHODS TO BE IMPLEMENTED BY CONCRETE CONNECTORS
    // =============================================================================
    
    /**
     * Store performance metrics with access control
     */
    protected abstract storeMetrics(
        accessRequest: AccessRequest, 
        metrics: AIComponentMetrics[]
    ): Promise<void>;
    
    /**
     * Retrieve metrics with time window filtering
     */
    protected abstract getMetrics(
        accessRequest: AccessRequest, 
        timeWindow?: MetricWindow
    ): Promise<AIComponentMetrics[]>;
    
    /**
     * Generate comprehensive performance report
     */
    protected abstract generateReport(
        accessRequest: AccessRequest
    ): Promise<AIAgentPerformanceReport>;
    
    /**
     * Clear stored metrics
     */
    protected abstract clearMetrics(
        accessRequest: AccessRequest
    ): Promise<void>;
    
    /**
     * Get performance events
     */
    protected abstract getEvents(
        accessRequest: AccessRequest, 
        since?: number
    ): Promise<AIPerformanceEvent[]>;
    
    /**
     * Update monitoring configuration
     */
    protected abstract updateConfig(
        accessRequest: AccessRequest, 
        config: Partial<AIPerformanceConfig>
    ): Promise<void>;
    
    /**
     * Export metrics in various formats
     */
    protected abstract exportMetrics(
        accessRequest: AccessRequest, 
        format: 'json' | 'prometheus' | 'csv'
    ): Promise<string>;
    
    /**
     * Get component baselines
     */
    protected abstract getBaselines(
        accessRequest: AccessRequest
    ): Promise<ComponentBaseline[]>;
    
    /**
     * Establish baseline for component
     */
    protected abstract establishBaseline(
        accessRequest: AccessRequest, 
        componentName: string
    ): Promise<ComponentBaseline>;
    
    // =============================================================================
    // OPTIONAL METHODS WITH DEFAULT IMPLEMENTATIONS
    // =============================================================================
    
    /**
     * Export to external monitoring systems
     */
    protected async exportToExternal(
        accessRequest: AccessRequest,
        exportConfig: ExternalMonitoringExport
    ): Promise<void> {
        // Default implementation - override in specific connectors
        throw new Error('External export not implemented in this connector');
    }
    
    /**
     * Perform health check on the connector
     */
    public async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: Record<string, any>;
    }> {
        try {
            // Basic connectivity test
            const testCandidate = new AccessCandidate({ id: 'system', role: TAccessRole.Public });
            await this.getMetrics(testCandidate.readRequest, {
                start: Date.now() - 1000,
                end: Date.now(),
                granularity: '1m' as const,
                aggregation: 'avg' as const
            });
            
            return {
                status: 'healthy',
                details: {
                    timestamp: Date.now(),
                    connectorType: this.constructor.name,
                    version: '1.0.0'
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    timestamp: Date.now(),
                    error: error.message,
                    connectorType: this.constructor.name
                }
            };
        }
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
        // Default implementation - override in specific connectors
        return {
            totalMetrics: 0,
            agentCount: 0,
            timeRange: { start: 0, end: 0 },
            storageSize: 0
        };
    }
}
