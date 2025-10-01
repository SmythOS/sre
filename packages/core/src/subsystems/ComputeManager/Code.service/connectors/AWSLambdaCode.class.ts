import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CodeConfig, CodePreparationResult, CodeConnector, CodeInput, CodeDeployment, CodeExecutionResult } from '../CodeConnector';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { cacheTTL, createOrUpdateLambdaFunction, generateCodeHash, generateLambdaCode, getCurrentEnvironmentVariables, getDeployedCodeHash, getDeployedFunction, getLambdaFunctionName, getSortedObjectValues, invokeLambdaFunction, setDeployedCodeHash, updateDeployedCodeTTL, validateAsyncMainFunction, zipCode } from '@sre/helpers/AWSLambdaCode.helper';
import { AWSCredentials, AWSRegionConfig } from '@sre/types/AWS.types';
import { Logger } from '@sre/helpers/Log.helper';
const LAMBDA_ROLE_PROPAGATION_ERROR = 'The role defined for the function cannot be assumed by Lambda.';
const console = Logger('AWSLambda');
import { delay } from '@sre/utils';

export class AWSLambdaCode extends CodeConnector {
    public name = 'AWSLambda';
    private awsConfigs: AWSCredentials & AWSRegionConfig;

    constructor(config: { region: string, accessKeyId: string, secretAccessKey: string }) {
        super(config);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        this.awsConfigs = config;
    }
    public async prepare(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult> {
        return {
            prepared: true,
            errors: [],
            warnings: [],
        };
    }

    public async deploy(acRequest: AccessRequest, codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment> {
        const agentId = acRequest.candidate.id;
        const functionName = getLambdaFunctionName(agentId, codeUID);
        const [isLambdaExists, exisitingCodeHash, currentEnvVariables] = await Promise.all([
            getDeployedFunction(functionName, this.awsConfigs),
            getDeployedCodeHash(agentId, codeUID),
            getCurrentEnvironmentVariables(acRequest.candidate.id, input.code),
        ]);

        // sorting values to get the same hash for the same env variables
        const envValues = getSortedObjectValues(currentEnvVariables);

        const codeHash = generateCodeHash(input.code, Object.keys(input.inputs), envValues);
        if (isLambdaExists && exisitingCodeHash === codeHash) {
            return {
                id: functionName,
                runtime: config.runtime,
                createdAt: new Date(),
                status: 'deployed',
            };
        }
        const baseFolder = `${process.cwd()}/lambda_archives`;
        if (!fs.existsSync(baseFolder)) {
            fs.mkdirSync(baseFolder);
        }
        const directory = `${baseFolder}/${functionName}__${Date.now()}`;
        try {
            const { isValid, parameters, error, dependencies } = validateAsyncMainFunction(input.code);
            if (!isValid) {
                throw new Error(error || 'Invalid Code')
            }
            const lambdaCode = generateLambdaCode(input.code, parameters, currentEnvVariables);
            // create folder
            fs.mkdirSync(directory);
            // create index.js file
            fs.writeFileSync(path.join(directory, 'index.mjs'), lambdaCode);
            // run command npm init
            execSync('npm init -y', { cwd: directory });
            // run command npm install
            execSync(`npm install ${dependencies.join(' ')}`, { cwd: directory });

            const zipFilePath = await zipCode(directory);
            await createOrUpdateLambdaFunction(functionName, zipFilePath, this.awsConfigs, currentEnvVariables);
            await setDeployedCodeHash(agentId, codeUID, codeHash);
            console.debug('Lambda function updated successfully!');
            return {
                id: functionName,
                runtime: config.runtime,
                createdAt: new Date(),
                status: 'deploying',
            };
        } catch (error) {
            throw error;
        } finally {
            try {
                fs.rmSync(`${directory}`, { recursive: true, force: true });
                fs.unlinkSync(`${directory}.zip`);
            } catch (error) { }
        }

    }

    public async execute(acRequest: AccessRequest, codeUID: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        try {
            const agentId = acRequest.candidate.id;
            const functionName = getLambdaFunctionName(agentId, codeUID);
            let lambdaResponse;
            try {
                lambdaResponse = JSON.parse(await invokeLambdaFunction(functionName, inputs, this.awsConfigs));
            } catch (error: any) {
                console.log('Error message: ', error.message)
                // Special case for role propagation error
                if (error.message.includes(LAMBDA_ROLE_PROPAGATION_ERROR)) {
                    let retryCount = 0;
                    while (retryCount < 3) {
                        try {
                            await delay(5000); // wait for 5 seconds before retrying
                            console.log('Retrying ... ' + retryCount + 1)
                            lambdaResponse = JSON.parse(await invokeLambdaFunction(functionName, inputs, this.awsConfigs));
                            break;
                        } catch (error: any) {
                            console.log('Error message: ', error.message)
                            if (error.message.includes(LAMBDA_ROLE_PROPAGATION_ERROR)) {
                                retryCount++;
                            } else {
                                throw error;
                            }
                        }
                    }
                } else {
                    throw error;
                }
            }
            const executionTime = lambdaResponse.executionTime;
            await updateDeployedCodeTTL(agentId, codeUID, cacheTTL);
            console.debug(
                `Code result:\n ${typeof lambdaResponse.result === 'object' ? JSON.stringify(lambdaResponse.result, null, 2) : lambdaResponse.result
                }\n`,
            );
            console.debug(`Execution time: ${executionTime}ms\n`);

            const Output = lambdaResponse.result;
            return {
                output: Output,
                executionTime: executionTime,
                success: true,
            };
        } catch (error: any) {
            console.error(`Error running code \n${error}\n`);
            const _error = error?.response?.data || error?.message || error.toString();
            const output = undefined; //prevents running next component if the code execution failed
            return { output, executionTime: 0, success: false, errors: [_error] };
        }
    }

    public async executeDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult> {
        const result = await this.execute(acRequest, codeUID, inputs, config);
        return result;
    }

    public async listDeployments(acRequest: AccessRequest, codeUID: string, config: CodeConfig): Promise<CodeDeployment[]> {
        const agentId = acRequest.candidate.id;
        const lambdaFunction = await getDeployedFunction(getLambdaFunctionName(agentId, codeUID), config.platformConfig as AWSCredentials & AWSRegionConfig);
        if (lambdaFunction) {
            return [
                {
                    id: lambdaFunction.functionName,
                    runtime: lambdaFunction.runtime,
                    createdAt: new Date(lambdaFunction.updatedAt),
                    status: lambdaFunction.status,
                    lastUpdated: new Date(lambdaFunction.updatedAt),
                }
            ]
        }

        return [];
    }

    public async getDeployment(acRequest: AccessRequest, codeUID: string, deploymentId: string, config: CodeConfig): Promise<CodeDeployment | null> {
        const agentId = acRequest.candidate.id;
        const lambdaFunction = await getDeployedFunction(getLambdaFunctionName(agentId, codeUID), config.platformConfig as AWSCredentials & AWSRegionConfig);
        if (lambdaFunction) {
            return {
                id: lambdaFunction.functionName,
                runtime: lambdaFunction.runtime,
                createdAt: new Date(lambdaFunction.updatedAt),
                status: lambdaFunction.status,
                lastUpdated: new Date(lambdaFunction.updatedAt),
            }
        }
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
