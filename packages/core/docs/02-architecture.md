---
title: "Architecture"
---

# SRE Core Architecture

The Smyth Runtime Environment (SRE) is designed with a philosophy inspired by operating system kernels. This approach establishes a clean separation between the core runtime services and the pluggable **Connectors** that interface with external services and infrastructure. This modularity is the key to Sre's flexibility and scalability.

## The SRE Lifecycle

The SRE is a singleton that gets initialized via the `SRE.init()` static method. This is the main entry point to the entire environment and is responsible for bootstrapping all configured subsystems based on the provided configuration.

Once initialized, the `sre.ready()` method must be called. This method asynchronously initializes all the specific connectors that were configured for each subsystem, ensuring they are connected and operational before any services are requested.

### Initialization Sequence

1.  **`SRE.init(config)`**: The configuration object is parsed, and each subsystem (like `Cache`, `Storage`, `Log`) is mapped to a specific connector implementation.
2.  **`sre.ready()`**: The SRE iterates through the configured subsystems and calls the `init()` method on each assigned connector. This is often an `async` operation, as it may involve establishing network connections or authenticating with external services.
3.  **Operational State**: Once `sre.ready()` resolves, the SRE is fully operational and its services can be safely accessed.

The full initialization process is managed within the main `SRE` class.

> _For the source code, see `packages/core/src/Core/sre.class.ts`._

## The Connector Model

The power of SRE's architecture lies in its connector model. Every external service, whether it's a database, a cache, a file system, or an LLM provider, is accessed through a `Connector`.

A connector is a class that implements a standardized interface for a specific type of service. For example, the `IStorageConnector` interface defines a set of methods (`write`, `read`, `delete`, `list`, etc.) that any storage connector must implement.

### How it Works

1.  **Interface Definition**: A common interface is defined for a service type (e.g., `IStorageConnector`).
2.  **Concrete Implementations**: Separate classes are created to implement this interface for different backend services (e.g., `LocalStorageConnector`, `S3StorageConnector`).
3.  **Configuration-based Loading**: The SRE's configuration file dictates which specific connector implementation to load at runtime.

This design allows a developer to switch the underlying infrastructure—for example, from local file storage to S3—by changing only a single line in the configuration file. The application code, which interacts with the `IStorageConnector` interface, remains completely unchanged.
