import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { SecureConnector } from '@sre/Security/SecureConnector.class';

export interface CodeInput {
    code: string; // Main code to execute
    dependencies?: string; // Dependencies/imports/packages
    files?: Record<string, string>; // Additional files (filename -> content)
    inputs?: Record<string, any>; // Runtime input parameters
}

export interface CodeConfig {
    runtime: string; // 'nodejs', 'python', 'java', etc.
    timeout?: number; // Execution timeout in milliseconds
    memoryLimit?: number; // Memory allocation in MB
    environment?: Record<string, string>; // Environment variables

    // Platform-specific settings
    platformConfig?: Record<string, any>;
}

export interface CodeExecutionResult {
    output: any; // The execution result/return value
    executionTime: number; // Execution time in milliseconds
    logs?: string[]; // Execution logs
    errors?: string[]; // Error messages
    success: boolean; // Whether execution succeeded
}

export interface CodePreparationResult {
    prepared: boolean; // Whether preparation succeeded
    errors?: string[]; // Preparation errors
    warnings?: string[]; // Preparation warnings
    metadata?: Record<string, any>; // Platform-specific preparation data
}

export interface CodeDeployment {
    id: string; // Deployment identifier
    status: 'deploying' | 'ready' | 'failed';
    runtime: string;
    createdAt: Date;
    lastUsed?: Date;
}

export interface ICodeRequest {
    // Core workflow
    prepare(input: CodeInput, config: CodeConfig): Promise<CodePreparationResult>;
    deploy(deploymentId: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment>;
    execute(input: CodeInput, config: CodeConfig): Promise<CodeExecutionResult>;

    // Execute with existing deployment (for platforms that support it)
    executeDeployment(deploymentId: string, inputs: Record<string, any>): Promise<CodeExecutionResult>;

    // Deployment management
    listDeployments(): Promise<CodeDeployment[]>;
    getDeployment(deploymentId: string): Promise<CodeDeployment | null>;
    deleteDeployment(deploymentId: string): Promise<void>;
}

export abstract class CodeConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    // Abstract methods that concrete connectors must implement
    protected abstract prepare(acRequest: AccessRequest, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult>;
    protected abstract deploy(acRequest: AccessRequest, deploymentId: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment>;
    protected abstract execute(acRequest: AccessRequest, input: CodeInput, config: CodeConfig): Promise<CodeExecutionResult>;
    protected abstract executeDeployment(acRequest: AccessRequest, deploymentId: string, inputs: Record<string, any>): Promise<CodeExecutionResult>;
    protected abstract listDeployments(acRequest: AccessRequest): Promise<CodeDeployment[]>;
    protected abstract getDeployment(acRequest: AccessRequest, deploymentId: string): Promise<CodeDeployment | null>;
    protected abstract deleteDeployment(acRequest: AccessRequest, deploymentId: string): Promise<void>;

    public requester(candidate: AccessCandidate): ICodeRequest {
        return {
            prepare: async (input: CodeInput, config: CodeConfig) => {
                return await this.prepare(candidate.readRequest, input, config);
            },
            deploy: async (deploymentId: string, input: CodeInput, config: CodeConfig) => {
                return await this.deploy(candidate.writeRequest, deploymentId, input, config);
            },
            execute: async (input: CodeInput, config: CodeConfig) => {
                return await this.execute(candidate.readRequest, input, config);
            },
            executeDeployment: async (deploymentId: string, inputs: Record<string, any>) => {
                return await this.executeDeployment(candidate.readRequest, deploymentId, inputs);
            },
            listDeployments: async () => {
                return await this.listDeployments(candidate.readRequest);
            },
            getDeployment: async (deploymentId: string) => {
                return await this.getDeployment(candidate.readRequest, deploymentId);
            },
            deleteDeployment: async (deploymentId: string) => {
                await this.deleteDeployment(candidate.writeRequest, deploymentId);
            },
        } as ICodeRequest;
    }
}
