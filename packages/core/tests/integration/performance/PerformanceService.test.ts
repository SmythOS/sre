import { describe, test, expect, beforeEach } from 'vitest';
import { PerformanceService } from '@sre/subsystems/PerformanceManager/Performance.service';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LocalPerformanceConnector } from '../../../src/subsystems/PerformanceManager/Performance.service/connectors/LocalPerformanceConnector.class';

describe('PerformanceService Integration', () => {
    let service: PerformanceService;

    beforeEach(() => {
        service = new PerformanceService();
    });

    test('should register performance connectors', () => {
        service.register();

        const localConnector = ConnectorService.getInstance(
            TConnectorService.Performance,
            'Local'
        );

        expect(localConnector).toBeDefined();
        expect(localConnector).toBeInstanceOf(LocalPerformanceConnector);
    });

    test('should initialize service', () => {
        service.register();
        service.init();

        const localConnector = ConnectorService.getInstance(
            TConnectorService.Performance,
            'Local'
        );

        expect(localConnector).toBeDefined();
        expect(localConnector['isInitialized']).toBe(true);
    });

    test('should handle disabled performance monitoring', () => {
        process.env.SRE_PERFORMANCE_DISABLED = 'true';
        service.register();
        service.init();

        const localConnector = ConnectorService.getInstance(
            TConnectorService.Performance,
            'Local'
        );

        expect(localConnector).toBeDefined();
        expect(localConnector['config'].global.enabled).toBe(false);

        // Cleanup
        delete process.env.SRE_PERFORMANCE_DISABLED;
    });

    test('should handle connector registration errors', () => {
        // Mock ConnectorService.register to throw
        const originalRegister = ConnectorService.register;
        ConnectorService.register = jest.fn().mockImplementation(() => {
            throw new Error('Registration failed');
        });

        expect(() => service.register()).toThrow('Registration failed');

        // Restore original
        ConnectorService.register = originalRegister;
    });

    test('should handle multiple initializations gracefully', () => {
        service.register();
        service.init();
        service.init(); // Second init should be handled gracefully

        const localConnector = ConnectorService.getInstance(
            TConnectorService.Performance,
            'Local'
        );

        expect(localConnector).toBeDefined();
        expect(localConnector['isInitialized']).toBe(true);
    });
});
