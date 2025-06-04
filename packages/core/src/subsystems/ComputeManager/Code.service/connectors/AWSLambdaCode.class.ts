import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CodeConfig, CodePreparationResult, CodeConnector, CodeInput, CodeDeployment, CodeExecutionResult } from '../CodeConnector';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

export class AWSLambdaCode extends CodeConnector {
    public name = 'AWSLambdaCode';

    public async prepare(acRequest: AccessRequest, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult> {
        return {
            prepared: true,
            errors: [],
            warnings: [],
        };
    }

    public async deploy(acRequest: AccessRequest, deploymentId: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment> {
        return {
            id: deploymentId,
            runtime: config.runtime,
            createdAt: new Date(),
            status: 'deploying',
        };
    }

    public async execute(acRequest: AccessRequest, input: CodeInput, config: CodeConfig): Promise<CodeExecutionResult> {
        return {
            output: {},
            executionTime: 0,
            success: true,
        };
    }

    public async executeDeployment(acRequest: AccessRequest, deploymentId: string, inputs: Record<string, any>): Promise<CodeExecutionResult> {
        return {
            output: {},
            executionTime: 0,
            success: true,
        };
    }

    public async listDeployments(acRequest: AccessRequest): Promise<CodeDeployment[]> {
        return [];
    }

    public async getDeployment(acRequest: AccessRequest, deploymentId: string): Promise<CodeDeployment | null> {
        return null;
    }

    public async deleteDeployment(acRequest: AccessRequest, deploymentId: string): Promise<void> {
        return;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const acl = new ACL();

        //give Read access everytime
        //FIXME: !!!!!! IMPORTANT !!!!!!  this implementation have to be changed in order to reflect the security model of AWS Lambda
        acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);

        return acl;
    }
}
