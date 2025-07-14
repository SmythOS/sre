import Docker from 'dockerode';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import {
    CodeConfig,
    CodeDeployment,
    CodeExecutionResult,
    CodeInput,
    CodePreparationResult,
    CodeConnector,
} from '../CodeConnector';

export class DockerCode extends CodeConnector {
    public name = 'Docker';
    private docker: Docker;
    private store: Record<string, CodeInput> = {};

    constructor(config: any = {}) {
        super(config);
        this.docker = new Docker(config);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }

    public async prepare(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult> {
        return { prepared: true };
    }

    public async deploy(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment> {
        const key = `${acRequest.candidate.id}:${codeUID}`;
        this.store[key] = input;
        return {
            id: codeUID,
            runtime: config.runtime,
            createdAt: new Date(),
            status: 'deployed',
        };
    }

    public async execute(acRequest: AccessRequest, codeUID: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        const key = `${acRequest.candidate.id}:${codeUID}`;
        const stored = this.store[key];
        if (!stored) {
            throw new Error('Code not deployed');
        }
        const start = Date.now();
        const timeout = config.timeout ?? 10000;
        const image = config.runtime || 'python:3.12-slim';
        const env = Object.entries(inputs || {}).map(([k, v]) => `${k}=${v}`);
        const container = await this.docker.createContainer({
            Image: image,
            Cmd: ['python', '-c', stored.code],
            Env: env,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
        });
        let stdout = '';
        let stderr = '';
        const stream = await container.attach({ stdout: true, stderr: true, stream: true });
        stream.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        stream.on('stderr', (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        await container.start();
        let exitCode = 0;
        try {
            const result = await Promise.race([
                container.wait(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
            ]) as any;
            exitCode = result.StatusCode;
        } catch (err) {
            await container.kill().catch(() => {});
            await container.remove().catch(() => {});
            return { output: stdout, executionTime: Date.now() - start, logs: stderr ? [stderr] : undefined, errors: [String(err)], success: false };
        }
        await container.remove();
        return {
            output: stdout.trim(),
            executionTime: Date.now() - start,
            logs: stderr ? [stderr] : undefined,
            errors: exitCode === 0 ? undefined : [stderr.trim()],
            success: exitCode === 0,
        };
    }

    public async executeDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        return this.execute(acRequest, codeUID, inputs, config);
    }

    public async listDeployments(acRequest: AccessRequest, codeUID: string, config: CodeConfig): Promise<CodeDeployment[]> {
        const key = `${acRequest.candidate.id}:${codeUID}`;
        if (this.store[key]) {
            return [{ id: codeUID, runtime: config.runtime, createdAt: new Date(), status: 'deployed' }];
        }
        return [];
    }

    public async getDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, config: CodeConfig): Promise<CodeDeployment | null> {
        const key = `${acRequest.candidate.id}:${codeUID}`;
        if (this.store[key]) {
            return { id: codeUID, runtime: config.runtime, createdAt: new Date(), status: 'deployed' };
        }
        return null;
    }

    public async deleteDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, config: CodeConfig): Promise<void> {
        const key = `${acRequest.candidate.id}:${codeUID}`;
        delete this.store[key];
    }
}

