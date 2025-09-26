import { ConnectorService, ConnectorServiceProvider } from '../../../Core/ConnectorsService';
import { TConnectorService } from '../../../types/SRE.types';
import { LocalPerformanceConnector } from './connectors/LocalPerformanceConnector.class';
import { Logger } from '../../../helpers/Log.helper';

/**
 * Performance Service Provider
 */
export class PerformanceService extends ConnectorServiceProvider {
    private logger = Logger('PerformanceService');
    
    /**
     * Register all available performance connectors
     */
    public register() {
        try {
            // Register local performance connector
            ConnectorService.register(
                TConnectorService.Performance,
                'Local',
                LocalPerformanceConnector
            );
            
            this.logger.info('Performance connectors registered successfully');
            
        } catch (error) {
            this.logger.warn('Failed to register performance connectors:', error);
            throw error;
        }
    }
    
    /**
     * Initialize performance service
     */
    public init() {
        super.init();
        
        this.logger.info('Performance Service initialized');
        
        // Auto-discover and configure performance monitoring
        this.autoConfigurePerformanceMonitoring();
    }
    
    /**
     * Auto-configure performance monitoring based on environment
     */
    private autoConfigurePerformanceMonitoring() {
        try {
            // Check if performance monitoring is explicitly disabled
            if (process.env.SRE_PERFORMANCE_DISABLED === 'true') {
                this.logger.info('Performance monitoring disabled by environment variable');
                return;
            }
            
            // Get performance connector instance
            const performanceConnector = ConnectorService.getInstance(TConnectorService.Performance, 'Local');
            
            if (performanceConnector) {
                this.logger.info('Performance monitoring auto-configured with Local connector');
            } else {
                this.logger.warn('Failed to initialize performance connector');
            }
            
        } catch (error) {
            this.logger.warn('Auto-configuration of performance monitoring failed:', error);
        }
    }
}

// Export connector for direct access
export { LocalPerformanceConnector } from './connectors/LocalPerformanceConnector.class';
export { PerformanceConnector } from './PerformanceConnector';

// Export types
export type { IPerformanceRequest } from './PerformanceConnector';
