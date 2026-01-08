---
title: 'extend/Custom Subsystems'
---

# Extending SRE: Custom Subsystems

For advanced use cases, you can extend the SRE by adding entirely new subsystems. A subsystem is a major functional unit of the SRE that provides a specific set of services, powered by its own set of pluggable connectors.

Creating a new subsystem is the most advanced way to extend the SRE and should be reserved for when you need to add a completely new category of functionality that doesn't fit within the existing subsystems.

## Subsystem Architecture

A new subsystem typically consists of:

1.  **A Service Provider Class**: This is the main entry point for your subsystem. It inherits from `ConnectorServiceProvider` and is responsible for managing the subsystem's connectors.

2.  **A Connector Interface**: An interface (e.g., `IMyNewServiceConnector`) that defines the contract that all connectors for this subsystem must adhere to.

3.  **One or More Connector Implementations**: Concrete classes that implement your connector interface for specific backends.

4.  **A Unique Service Enum**: A unique identifier for your subsystem, which you add to the `TConnectorService` enum.

## High-Level Steps

1.  **Define the Interface**: Create your `IMyNewServiceConnector.ts` file, defining the methods and properties for your new service type.

2.  **Create the Service Provider**: Create a class `MyNewService extends ConnectorServiceProvider` to manage the registration and retrieval of your new connectors.

3.  **Implement Connectors**: Build one or more classes that implement your new interface.

4.  **Integrate with SRE**:
    -   Add your new subsystem to the main `SRE` class, giving it a namespace (e.g., `SRE.MyNewSystem`).
    -   Initialize your `MyNewService` provider within the SRE's constructor.
    -   Update the SRE's `init` and `ready` methods to handle the configuration and initialization of your new subsystem.

Due to the complexity and deep integration required, creating a new subsystem should be done with a thorough understanding of the SRE's core architecture. It is often recommended to first explore creating custom components or connectors to see if they can meet your needs.
