# Observability Manager

The Observability Manager is responsible for collecting, processing, and exporting telemetry data and logs from the Smyth Runtime Environment. It provides insights into the behavior and performance of the system and the agents running within it.

## Log Service

The Log Service provides a structured logging interface for agents and the SRE itself. It abstracts the underlying logging implementation, allowing for consistent log formatting and routing.

-   **Interface**: `ILogConnector`
-   **Service Access**: `ConnectorService.getLogConnector()`
-   **Default Implementation**: `ConsoleLog`

### Log Connector

The `LogConnector` extends `SecureConnector` and enforces access control, ensuring that only authorized candidates (specifically agents) can write logs.

#### Key Methods

-   `log(logData: AgentCallLog, callId?: string): Promise<any>`: Logs an agent call event.
-   `logTask(tasks: number, isUsingTestDomain: boolean): Promise<void>`: Logs task usage metrics.

### Configuration

To configure the Log Service, add a `Log` entry to the SRE configuration:

```typescript
SRE.init({
    Log: {
        Connector: 'ConsoleLog',
        Settings: {
            // ... specific settings for the connector
        },
    },
});
```

## Telemetry Service

The Telemetry Service provides integration with OpenTelemetry (OTel) for distributed tracing and metrics collection. It allows you to monitor the performance of agents, connectors, and the SRE core.

-   **Interface**: `ITelemetryConnector`
-   **Service Access**: `ConnectorService.getTelemetryConnector()`
-   **Default Implementation**: `OTel`

### OpenTelemetry Connector (OTel)

The `OTel` connector initializes the OpenTelemetry Node.js SDK and exports traces to a configured endpoint (e.g., a Jaeger or Zipkin collector, or an OTel Collector).

### Configuration

To enable OpenTelemetry, configure the `Telemetry` service in `SRE.init`:

```typescript
SRE.init({
    Telemetry: {
        Connector: 'OTel',
        Settings: {
            endpoint: 'http://localhost:4318', // OTel Collector HTTP endpoint
            serviceName: 'smythos-agent', // Optional service name
            serviceVersion: '1.0.0', // Optional service version
            headers: {
                // Optional headers
                Authorization: 'Bearer your-api-key',
            },
        },
    },
});
```

### Example

The following example demonstrates how to initialize the SRE with OpenTelemetry enabled:

```typescript
import { SRE } from '@smythos/sdk/core';

SRE.init({
    Telemetry: {
        Connector: 'OTel',
        Settings: {
            endpoint: 'http://localhost:4318',
        },
    },
});
```
