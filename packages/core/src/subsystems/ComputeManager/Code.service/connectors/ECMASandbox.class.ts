import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CodeConfig, CodePreparationResult, CodeConnector, CodeInput, CodeDeployment, CodeExecutionResult } from '../CodeConnector';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { Logger } from '@sre/helpers/Log.helper';
import axios from 'axios';
import { generateExecutableCode, runJs } from '@sre/helpers/ECMASandbox.helper';
import { validateAsyncMainFunction } from '@sre/helpers/AWSLambdaCode.helper';

const console = Logger('ECMASandbox');
export class ECMASandbox extends CodeConnector {
    public name = 'ECMASandbox';
    private sandboxUrl: string;

    constructor(config: { sandboxUrl: string }) {
        super(config);
        this.sandboxUrl = config.sandboxUrl;
    }
    public async prepare(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult> {
        return {
            prepared: true,
            errors: [],
            warnings: [],
        };
    }

    public async deploy(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment> {
        return {
            id: codeUID,
            runtime: config.runtime,
            createdAt: new Date(),
            status: 'Deployed',
        };
    }

    public async execute(acRequest: AccessRequest, codeUID: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        try {
            const { isValid, error, parameters } = validateAsyncMainFunction(inputs.code);
            if (!isValid) {
                return {
                    output: undefined,
                    executionTime: 0,
                    success: false,
                    errors: [error],
                }
            }
            const executableCode = generateExecutableCode(inputs.code, parameters, inputs.inputs);
            if (!this.sandboxUrl) {
                // run js code in isolated vm
                console.debug('Running code in isolated vm');
                const result = await runJs(executableCode);
                console.debug(`Code result: ${result}`);
                return {
                    output: result?.Output,
                    executionTime: 0,
                    success: true,
                    errors: [],
                };
            } else {
                console.debug('Running code in remote sandbox');
                const result: any = await axios.post(this.sandboxUrl, { code: executableCode }).catch((error) => ({ error }));
                if (result.error) {

                    const error = result.error?.response?.data || result.error?.message || result.error.toString() || 'Unknown error';
                    console.error(`Error running code: ${JSON.stringify(error, null, 2)}`);
                    return {
                        output: undefined,
                        executionTime: 0,
                        success: false,
                        errors: [error],
                    };
                } else {
                    console.debug(`Code result: ${result?.data?.Output}`);
                    return {
                        output: result.data?.Output,
                        executionTime: 0,
                        success: true,
                        errors: [],
                    };
                }
            }
        } catch (error) {
            console.error(`Error running code: ${error}`);
            return {
                output: undefined,
                executionTime: 0,
                success: false,
                errors: [error],
            };
        }
    }
    public async executeDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        const result = await this.execute(acRequest, codeUID, inputs, config);
        return result;
    }

    public async listDeployments(acRequest: AccessRequest, codeUID: string, config: CodeConfig): Promise<CodeDeployment[]> {
        return [];
    }

    public async getDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, config: CodeConfig): Promise<CodeDeployment | null> {
        return null;
    }

    public async deleteDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string): Promise<void> {
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
