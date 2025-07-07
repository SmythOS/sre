import crypto from 'crypto';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import zl from 'zip-lib';
import fs from 'fs';
import { AWSConfig, AWSCredentials, AWSRegionConfig } from '@sre/types/AWS.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { IAgent } from '@sre/types/Agent.types';
import { SystemEvents } from '@sre/Core/SystemEvents';

import { LazyLoadFallback } from '@sre/utils/lazy-client';
import type * as LambdaTypes from '@aws-sdk/client-lambda';

let LambdaModule: typeof LambdaTypes | undefined;
//#IFDEF STATIC AWS_LAMBDA_STATIC
import * as _LambdaModule from '@aws-sdk/client-lambda';
LambdaModule = _LambdaModule;
//#ENDIF

import type * as IAMTypes from '@aws-sdk/client-iam';
let IAMModule: typeof IAMTypes | undefined;
//#IFDEF STATIC AWS_IAM_STATIC
import * as _IAMModule from '@aws-sdk/client-iam';
IAMModule = _IAMModule;
//#ENDIF

//import { GetRoleCommand, CreateRoleCommand, IAMClient, GetRoleCommandOutput, CreateRoleCommandOutput } from '@aws-sdk/client-iam';

export const cachePrefix = 'serverless_code';
export const cacheTTL = 60 * 60 * 24 * 16; // 16 days
const PER_SECOND_COST = 0.0001;

export function getLambdaFunctionName(agentId: string, componentId: string) {
    return `${agentId}-${componentId}`;
}

export function generateCodeHash(code_body: string, code_imports: string, codeInputs: string[]) {
    const importsHash = getSanitizeCodeHash(code_imports);
    const bodyHash = getSanitizeCodeHash(code_body);
    const inputsHash = getSanitizeCodeHash(JSON.stringify(codeInputs));
    return `imports-${importsHash}__body-${bodyHash}__inputs-${inputsHash}`;
}

export function getSanitizeCodeHash(code: string) {
    let output = '';
    let isSingleQuote = false;
    let isDoubleQuote = false;
    let isTemplateLiteral = false;
    let isRegex = false;
    let isComment = false;
    let prevChar = '';

    for (let i = 0; i < code.length; i++) {
        let char = code[i];
        let nextChar = code[i + 1];

        // Toggle string flags
        if (char === "'" && !isDoubleQuote && !isTemplateLiteral && prevChar !== '\\') isSingleQuote = !isSingleQuote;
        if (char === '"' && !isSingleQuote && !isTemplateLiteral && prevChar !== '\\') isDoubleQuote = !isDoubleQuote;
        if (char === '`' && !isSingleQuote && !isDoubleQuote && prevChar !== '\\') isTemplateLiteral = !isTemplateLiteral;

        // Handle regex cases
        if (char === '/' && nextChar === '/' && !isSingleQuote && !isDoubleQuote && !isTemplateLiteral && !isRegex) {
            isComment = true; // Single-line comment
        }
        if (char === '/' && nextChar === '*' && !isSingleQuote && !isDoubleQuote && !isTemplateLiteral) {
            isComment = true; // Multi-line comment start
        }
        if (char === '*' && nextChar === '/' && isComment) {
            isComment = false; // Multi-line comment end
            i++; // Skip ending slash
            continue;
        }
        if (char === '\n' && isComment) {
            isComment = false; // End single-line comment
        }

        if (!isComment) {
            output += char;
        }
        prevChar = char;
    }

    return crypto.createHash('md5').update(output.replace(/\s+/g, ' ').trim()).digest('hex');
}

export async function getDeployedCodeHash(agentId: string, componentId: string) {
    const redisCache = ConnectorService.getCacheConnector();
    const cachedCodeHash = await redisCache.user(AccessCandidate.agent(agentId)).get(`${cachePrefix}_${agentId}-${componentId}`);
    return cachedCodeHash;
}

export async function setDeployedCodeHash(agentId: string, componentId: string, codeHash: string) {
    const redisCache = ConnectorService.getCacheConnector();
    await redisCache.user(AccessCandidate.agent(agentId)).set(`${cachePrefix}_${agentId}-${componentId}`, codeHash, null, null, cacheTTL);
}

export function extractNpmImports(code: string) {
    const importRegex = /import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

    let libraries = new Set();
    let match;

    // Function to extract the main package name
    function extractPackageName(modulePath: string) {
        if (modulePath.startsWith('@')) {
            // Handle scoped packages (e.g., @babel/core)
            return modulePath.split('/').slice(0, 2).join('/');
        }
        return modulePath.split('/')[0]; // Extract the first part (main package)
    }
    // Match static ESM imports
    while ((match = importRegex.exec(code)) !== null) {
        libraries.add(extractPackageName(match[1]));
    }
    // Match CommonJS require() calls
    while ((match = requireRegex.exec(code)) !== null) {
        libraries.add(extractPackageName(match[1]));
    }
    // Match dynamic import() calls
    while ((match = dynamicImportRegex.exec(code)) !== null) {
        libraries.add(extractPackageName(match[1]));
    }

    return Array.from(libraries);
}

export function generateLambdaCode(code_imports: string, code_body: string, input_variables: string[]) {
    const lambdaCode = `${code_imports}\nexport const handler = async (event, context) => {
      try {
        context.callbackWaitsForEmptyEventLoop = false;
        let startTime = Date.now();
        const result = await (async () => {
          ${input_variables && input_variables.length ? input_variables.map((variable) => `const ${variable} = event.${variable};`).join('\n') : ''}
          ${code_body}
        })();
        let endTime = Date.now();
        return {
            result,
            executionTime: endTime - startTime
        }
      } catch (e) {
        throw e;
      }
    };`;
    return lambdaCode;
}

export async function zipCode(directory: string) {
    return new Promise((resolve, reject) => {
        zl.archiveFolder(directory, `${directory}.zip`).then(
            function () {
                resolve(`${directory}.zip`);
            },
            function (err) {
                reject(err);
            }
        );
    });
}

export async function createOrUpdateLambdaFunction(functionName, zipFilePath, awsConfigs) {
    const { LambdaClient, UpdateFunctionCodeCommand, CreateFunctionCommand } = await LazyLoadFallback<typeof LambdaTypes>(
        LambdaModule,
        '@aws-sdk/client-lambda'
    );

    const client = new LambdaClient({
        region: awsConfigs.region,
        credentials: {
            accessKeyId: awsConfigs.accessKeyId,
            secretAccessKey: awsConfigs.secretAccessKey,
        },
    });
    const functionContent = fs.readFileSync(zipFilePath);

    try {
        const { IAMClient, GetRoleCommand, CreateRoleCommand } = await LazyLoadFallback<typeof IAMTypes>(IAMModule, '@aws-sdk/client-iam');
        const { Runtime } = await LazyLoadFallback<typeof LambdaTypes>(LambdaModule, '@aws-sdk/client-lambda');
        // Check if the function exists
        const exisitingFunction = await getDeployedFunction(functionName, awsConfigs);
        if (exisitingFunction) {
            if (exisitingFunction.status === 'InProgress') {
                await verifyFunctionDeploymentStatus(functionName, client);
            }
            // Update function code if it exists
            const updateCodeParams = {
                FunctionName: functionName,
                ZipFile: functionContent,
            };
            const updateFunctionCodeCommand = new UpdateFunctionCodeCommand(updateCodeParams);
            await client.send(updateFunctionCodeCommand);
            // Update function configuration to attach layer
            await verifyFunctionDeploymentStatus(functionName, client);
            // console.log('Lambda function code and configuration updated successfully!');
        } else {
            // Create function if it does not exist
            let roleArn = '';
            // check if the role exists
            try {
                const iamClient = new IAMClient({
                    region: awsConfigs.region,
                    credentials: { accessKeyId: awsConfigs.accessKeyId, secretAccessKey: awsConfigs.secretAccessKey },
                });
                const getRoleCommand = new GetRoleCommand({ RoleName: `smyth-${functionName}-role` });
                const roleResponse: IAMTypes.GetRoleCommandOutput = await iamClient.send(getRoleCommand);
                roleArn = roleResponse.Role.Arn;
            } catch (error) {
                if (error.name === 'NoSuchEntityException') {
                    // create role
                    const iamClient = new IAMClient({
                        region: awsConfigs.region,
                        credentials: { accessKeyId: awsConfigs.accessKeyId, secretAccessKey: awsConfigs.secretAccessKey },
                    });
                    const createRoleCommand = new CreateRoleCommand({
                        RoleName: `smyth-${functionName}-role`,
                        AssumeRolePolicyDocument: getLambdaRolePolicy(),
                    });
                    const roleResponse: IAMTypes.CreateRoleCommandOutput = await iamClient.send(createRoleCommand);
                    await waitForRoleDeploymentStatus(`smyth-${functionName}-role`, iamClient);
                    roleArn = roleResponse.Role.Arn;
                } else {
                    throw error;
                }
            }

            const functionParams = {
                Code: { ZipFile: functionContent },
                FunctionName: functionName,
                Handler: 'index.handler',
                Role: roleArn,
                Runtime: Runtime.nodejs18x,
                Layers: [],
                Timeout: 900,
                Tags: {
                    'auto-delete': 'true',
                },
                MemorySize: 256,
            };

            const functionCreateCommand = new CreateFunctionCommand(functionParams);
            const functionResponse = await client.send(functionCreateCommand);
            // console.log('Function ARN:', functionResponse.FunctionArn);
            await verifyFunctionDeploymentStatus(functionName, client);
        }
    } catch (error) {
        throw error;
    }
}

export async function waitForRoleDeploymentStatus(roleName, client): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        try {
            const { GetRoleCommand } = await LazyLoadFallback<typeof IAMTypes>(IAMModule, '@aws-sdk/client-iam');
            let interval = setInterval(async () => {
                const getRoleCommand = new GetRoleCommand({ RoleName: roleName });
                const roleResponse = await client.send(getRoleCommand);
                if (roleResponse.Role.AssumeRolePolicyDocument) {
                    clearInterval(interval);
                    return resolve(true);
                }
            }, 7000);
        } catch (error) {
            return false;
        }
    });
}

export async function verifyFunctionDeploymentStatus(functionName, client): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        try {
            const { GetFunctionCommand } = await LazyLoadFallback<typeof LambdaTypes>(LambdaModule, '@aws-sdk/client-lambda');
            let interval = setInterval(async () => {
                const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName });
                const lambdaResponse = await client.send(getFunctionCommand);

                if (lambdaResponse.Configuration.LastUpdateStatus === 'Successful') {
                    clearInterval(interval);
                    return resolve(true);
                }
            }, 5000);
        } catch (error) {
            return false;
        }
    });
}

export function getLambdaRolePolicy() {
    return JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: {
                    Service: 'lambda.amazonaws.com',
                },
                Action: 'sts:AssumeRole',
            },
        ],
    });
}

export async function updateDeployedCodeTTL(agentId: string, componentId: string, ttl: number) {
    const redisCache = ConnectorService.getCacheConnector();
    await redisCache.user(AccessCandidate.agent(agentId)).updateTTL(`${cachePrefix}_${agentId}-${componentId}`, ttl);
}

export async function invokeLambdaFunction(
    functionName: string,
    inputs: { [key: string]: any },
    awsCredentials: AWSCredentials & AWSRegionConfig
): Promise<any> {
    try {
        const { LambdaClient, InvokeCommand } = await LazyLoadFallback<typeof LambdaTypes>(LambdaModule, '@aws-sdk/client-lambda');
        const client = new LambdaClient({
            region: awsCredentials.region as string,
            ...(awsCredentials.accessKeyId && {
                credentials: {
                    accessKeyId: awsCredentials.accessKeyId as string,
                    secretAccessKey: awsCredentials.secretAccessKey as string,
                },
            }),
        });

        const invokeCommand = new InvokeCommand({
            FunctionName: functionName,
            Payload: new TextEncoder().encode(`${JSON.stringify(inputs)}`),
            InvocationType: 'RequestResponse',
        });

        const response: LambdaTypes.InvokeCommandOutput = await client.send(invokeCommand);
        if (response.FunctionError) {
            throw new Error(new TextDecoder().decode(response.Payload));
        }
        return new TextDecoder().decode(response.Payload);
    } catch (error) {
        throw error;
    }
}

export async function getDeployedFunction(functionName: string, awsConfigs: AWSCredentials & AWSRegionConfig) {
    try {
        const { LambdaClient, GetFunctionCommand } = await LazyLoadFallback<typeof LambdaTypes>(LambdaModule, '@aws-sdk/client-lambda');
        const client = new LambdaClient({
            region: awsConfigs.region as string,
            credentials: {
                accessKeyId: awsConfigs.accessKeyId as string,
                secretAccessKey: awsConfigs.secretAccessKey as string,
            },
        });
        const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName });
        const lambdaResponse: LambdaTypes.GetFunctionCommandOutput = await client.send(getFunctionCommand);
        return {
            status: lambdaResponse.Configuration.LastUpdateStatus,
            functionName: lambdaResponse.Configuration.FunctionName,
            functionVersion: lambdaResponse.Configuration.Version,
            updatedAt: lambdaResponse.Configuration.LastModified,
            role: lambdaResponse.Configuration.Role,
            runtime: lambdaResponse.Configuration.Runtime,
            version: lambdaResponse.Configuration.Version,
        };
    } catch (error) {
        return null;
    }
}

export async function getLambdaCredentials(agent: IAgent, config: any): Promise<AWSConfig & { isUserProvidedKeys: boolean }> {
    let awsAccessKeyId = null;
    let awsSecretAccessKey = null;
    let awsRegion = null;
    let userProvidedKeys = false;
    if (config.data.accessKeyId && config.data.secretAccessKey && config.data.region && config.data.use_own_keys) {
        userProvidedKeys = true;
        [awsAccessKeyId, awsSecretAccessKey] = await Promise.all([
            VaultHelper.getTeamKey(extractKeyFromTemplateVar(config.data.accessKeyId), agent?.teamId),
            VaultHelper.getTeamKey(extractKeyFromTemplateVar(config.data.secretAccessKey), agent?.teamId),
        ]);
        awsRegion = config.data.region;
    }
    const awsCredentials = {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        region: awsRegion,
        isUserProvidedKeys: userProvidedKeys,
    };
    return awsCredentials;
}

export function calculateExecutionCost(executionTime: number) {
    // executionTime in milliseconds
    const cost = (executionTime / 1000) * Number(PER_SECOND_COST);
    return cost;
}

export function extractKeyFromTemplateVar(input: string) {
    const regex = /\{\{KEY\((.*?)\)\}\}/;
    const match = input.match(regex);
    return match ? match[1] : input;
}

export function reportUsage({ cost, agentId, teamId }: { cost: number; agentId: string; teamId: string }) {
    SystemEvents.emit('USAGE:API', {
        sourceId: 'api:serverless_code.smyth',
        cost,
        agentId,
        teamId,
    });
}
