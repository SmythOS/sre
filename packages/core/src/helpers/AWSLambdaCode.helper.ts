import crypto from 'crypto';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import zl from 'zip-lib';
import { InvokeCommand, Runtime, LambdaClient, UpdateFunctionCodeCommand, CreateFunctionCommand, GetFunctionCommand, GetFunctionCommandOutput, InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { GetRoleCommand, CreateRoleCommand, IAMClient, GetRoleCommandOutput, CreateRoleCommandOutput } from '@aws-sdk/client-iam';
import fs from 'fs';
import { AWSConfig, AWSCredentials, AWSRegionConfig } from '@sre/types/AWS.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { IAgent } from '@sre/types/Agent.types';
import { SystemEvents } from '@sre/Core/SystemEvents';
import * as acorn from 'acorn';

export const cachePrefix = 'serverless_code';
export const cacheTTL = 60 * 60 * 24 * 16; // 16 days
const PER_SECOND_COST = 0.0001;

export function getLambdaFunctionName(agentId: string, componentId: string) {
    return `${agentId}-${componentId}`;
}


export function generateCodeHash(code_body: string, codeInputs: string[]) {
    const bodyHash = getSanitizeCodeHash(code_body);
    const inputsHash = getSanitizeCodeHash(JSON.stringify(codeInputs));
    return `body-${bodyHash}__inputs-${inputsHash}`;
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
    await redisCache
        .user(AccessCandidate.agent(agentId))
        .set(`${cachePrefix}_${agentId}-${componentId}`, codeHash, null, null, cacheTTL);
}

export function generateLambdaCode(code: string, parameters: string[]) {
    const lambdaCode = `
    ${code}
    export const handler = async (event, context) => {
      try {
        context.callbackWaitsForEmptyEventLoop = false;
        let startTime = Date.now();

        ${parameters && parameters.length ? parameters.map((variable) => `const ${variable} = event.${variable};`).join('\n') : ''}
        const result = await main(${parameters.join(', ')});
      
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
            },
        );
    });
}

export async function createOrUpdateLambdaFunction(functionName, zipFilePath, awsConfigs) {
    const client = new LambdaClient({
        region: awsConfigs.region,
        credentials: {
            accessKeyId: awsConfigs.accessKeyId,
            secretAccessKey: awsConfigs.secretAccessKey,
        },
    });
    const functionContent = fs.readFileSync(zipFilePath);

    try {
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
                const roleResponse: GetRoleCommandOutput = await iamClient.send(getRoleCommand);
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
                    const roleResponse: CreateRoleCommandOutput = await iamClient.send(createRoleCommand);
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
    return new Promise((resolve, reject) => {
        try {
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
    return new Promise((resolve, reject) => {
        try {
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
    awsCredentials: AWSCredentials & AWSRegionConfig,
): Promise<any> {
    try {
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

        const response: InvokeCommandOutput = await client.send(invokeCommand);
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
        const client = new LambdaClient({
            region: awsConfigs.region as string,
            credentials: {
                accessKeyId: awsConfigs.accessKeyId as string,
                secretAccessKey: awsConfigs.secretAccessKey as string,
            },
        });
        const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName });
        const lambdaResponse: GetFunctionCommandOutput = await client.send(getFunctionCommand);
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

export function validateAsyncMainFunction(code: string): { isValid: boolean; error?: string; parameters?: string[]; dependencies?: string[] } {
    try {
        // Parse the code using acorn
        const ast = acorn.parse(code, { 
            ecmaVersion: 'latest',
            sourceType: 'module'
        });

        // Extract library imports
        const libraries = new Set<string>();
        function extractPackageName(modulePath: string): string {
            if (modulePath.startsWith('@')) {
                // Handle scoped packages (e.g., @babel/core)
                return modulePath.split('/').slice(0, 2).join('/');
            }
            return modulePath.split('/')[0]; // Extract the first part (main package)
        }

        function processNodeForImports(node: any): void {
            if (!node) return;

            // Handle ImportDeclaration (ES6 imports)
            if (node.type === 'ImportDeclaration') {
                const modulePath = node.source.value;
                if (modulePath && !modulePath.startsWith('.') && !modulePath.startsWith('/')) {
                    // Skip relative imports and absolute paths
                    libraries.add(extractPackageName(modulePath));
                }
            }

            // Handle CallExpression (require() calls)
            if (node.type === 'CallExpression' && 
                node.callee.type === 'Identifier' && 
                node.callee.name === 'require' &&
                node.arguments.length > 0 &&
                node.arguments[0].type === 'Literal') {
                const modulePath = node.arguments[0].value;
                if (modulePath && !modulePath.startsWith('.') && !modulePath.startsWith('/')) {
                    libraries.add(extractPackageName(modulePath));
                }
            }

            // Handle dynamic import() calls
            if (node.type === 'CallExpression' && 
                node.callee.type === 'Import' &&
                node.arguments.length > 0 &&
                node.arguments[0].type === 'Literal') {
                const modulePath = node.arguments[0].value;
                if (modulePath && !modulePath.startsWith('.') && !modulePath.startsWith('/')) {
                    libraries.add(extractPackageName(modulePath));
                }
            }

            // Recursively process child nodes
            for (const key in node) {
                if (node[key] && typeof node[key] === 'object') {
                    if (Array.isArray(node[key])) {
                        (node[key] as any[]).forEach(processNodeForImports);
                    } else {
                        processNodeForImports(node[key]);
                    }
                }
            }
        }

        // Extract dependencies from the entire AST
        processNodeForImports(ast);
        const dependencies = Array.from(libraries) as string[];

        // Check if there's a function declaration or function expression named 'main' at the root level
        let hasAsyncMain = false;
        let hasMain = false;
        let mainParameters: string[] = [];

        for (const node of ast.body) {
            if (node.type === 'FunctionDeclaration') {
                if (node.id?.name === 'main') {
                    hasMain = true;
                    if (node.async) {
                        hasAsyncMain = true;
                        mainParameters = extractParameters(node.params);
                        break;
                    }
                }
            } else if (node.type === 'VariableDeclaration') {
                // Check for const/let/var main = async function() or const/let/var main = async () =>
                for (const declarator of node.declarations) {
                    if (declarator.id.type === 'Identifier' && declarator.id.name === 'main') {
                        hasMain = true;
                        if (declarator.init) {
                            if (declarator.init.type === 'FunctionExpression' && declarator.init.async) {
                                hasAsyncMain = true;
                                mainParameters = extractParameters(declarator.init.params);
                                break;
                            } else if (declarator.init.type === 'ArrowFunctionExpression' && declarator.init.async) {
                                hasAsyncMain = true;
                                mainParameters = extractParameters(declarator.init.params);
                                break;
                            }
                        }
                    }
                }
            } else if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
                // Check for main = async function() or main = async () =>
                if (node.expression.left.type === 'Identifier' && node.expression.left.name === 'main') {
                    hasMain = true;
                    const right = node.expression.right;
                    if ((right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression') && right.async) {
                        hasAsyncMain = true;
                        mainParameters = extractParameters(right.params);
                        break;
                    }
                }
            }
        }

        if (!hasMain) {
            return { 
                isValid: false, 
                error: 'No main function found at root level',
                dependencies
            };
        }

        if (!hasAsyncMain) {
            return { 
                isValid: false, 
                error: 'Main function exists but is not async',
                dependencies
            };
        }

        return { isValid: true, parameters: mainParameters, dependencies };
    } catch (error) {
        return { 
            isValid: false, 
            error: `Failed to parse code: ${error.message}` 
        };
    }
}

function extractParameters(params: any[]): string[] {
    return params.map((param: any): string => {
        if (param.type === 'Identifier') {
            return param.name;
        } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            return param.left.name;
        } else if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
            return param.argument.name;
        } else if (param.type === 'ObjectPattern') {
            // For destructured objects, return the object name or a placeholder
            return param.name || '[object]';
        } else if (param.type === 'ArrayPattern') {
            // For destructured arrays, return a placeholder
            return '[array]';
        }
        return '[unknown]';
    });
}

export function generateCodeFromLegacyComponent(code_body: string, code_imports: string, codeInputs: string[]) {
    const code = `
    ${code_imports}
     async function main(${codeInputs.join(', ')}) {
        ${code_body}
    }
    `
    return code;
}

