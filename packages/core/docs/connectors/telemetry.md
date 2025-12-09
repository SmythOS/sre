# Telemetry Connector (beta)

The Telemetry Connector provides an interface for collecting and exporting observability data, such as distributed traces and metrics.

## Interface: `ITelemetryRequest`

_Currently, the Telemetry interface is primarily internal, handling automatic instrumentation and export._

## Connectors

### OTel (OpenTelemetry)

Initializes the OpenTelemetry Node.js SDK with auto-instrumentation for HTTP, gRPC, and other standard libraries.

-   **Settings**:
    -   `endpoint`: The OTel Collector endpoint (e.g., `http://localhost:4318`).
    -   `serviceName`: Name of the service resource.
    -   `serviceVersion`: Version of the service.
    -   `headers`: Custom headers for the exporter (e.g., for authentication).

## Configuration Example

```typescript
SRE.init({
    Telemetry: {
        Connector: 'OTel',
        Settings: {
            endpoint: 'http://jaeger:4318',
            serviceName: 'my-smythos-agent',
        },
    },
});
```
