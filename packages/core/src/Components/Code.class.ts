import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import _config from '@sre/config';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { CreateFunctionCommand, GetFunctionCommand, InvokeCommand, LambdaClient, Runtime, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';
import SREConfig from '@sre/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// import zipFolder from 'zip-folder';
import { CreateRoleCommand, GetRoleCommand, IAMClient } from '@aws-sdk/client-iam';
import zl from 'zip-lib';
import crypto from 'crypto';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TemplateStringHelper } from '@sre/helpers/TemplateString.helper';
import axios from 'axios';
type AWSCredentials = { accessKeyId: string, secretAccessKey: string, region: string }

export default class Code extends Component {
    private cachePrefix: string = 'serverless_code';
    private cacheTTL: number = 60 * 60 * 24 * 16; // 16 days
    protected configSchema = Joi.object({
        code_imports: Joi.string().max(1000).allow('').label('Imports'),
        code_body: Joi.string().max(500000).allow('').label('Code'),
        deploy_btn: Joi.string().max(500000).allow('').label('Deploy'),
        access_key_id: Joi.string().max(100).allow('').label('AWS Access Key ID').optional(),
        secret_access_key: Joi.string().max(200).allow('').label('AWS Secret Access Key').optional(),
        region: Joi.string().label('AWS Region').optional(),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
        function_label: Joi.string().max(100).allow('').label('Function Label').optional(),
        function_label_end: Joi.string().allow(null).label('Function Label End').optional(),
        javascript_code_variables: Joi.string().allow('').label('Javascript Code Variables').optional(),
        javascript_code_body: Joi.string().allow('').label('Javascript Code Body').optional(),
        code_environment: Joi.string().allow('').label('Code Environment').optional(),
        use_own_keys: Joi.boolean().label('Use Own Keys').optional(),
    });
    constructor() {
        super();
    }
    init() { }
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);
        try {
            logger.debug(`=== Serverless Code Log ===`);
            let Output: any = {};
            let _error = undefined;
            if (config?.data?.code_environment === 'javascript') {
                const url = _config.env.CODE_SANDBOX_URL + '/run-js';

                let codeInputs = {};
                for (let fieldName in input) {
                    const _type = typeof input[fieldName];
                    switch (_type) {
                        case 'string':
                            //escape string
                            //codeInputs[fieldName] = `\`${input[fieldName]}\``;

                            //encode string
                            const b64encoded = Buffer.from(input[fieldName]).toString('base64');
                            codeInputs[fieldName] = `___internal.b64decode('${b64encoded}')`;

                            break;
                        case 'number':
                        case 'boolean':
                            codeInputs[fieldName] = input[fieldName];
                            break;
                        default:
                            codeInputs[fieldName] = input[fieldName];
                            break;
                    }
                }
                //FIXME : don't trust code_vars from user input ==> generate it

                // let code_vars = parseTemplate(config.data.code_vars || '', codeInputs, { escapeString: false, processUnmatched: false });
                let code_vars = TemplateStringHelper.create(config.data.javascript_code_variables || '')
                    .parse(codeInputs)
                    .clean(undefined, 'undefined').result;

                //TODO: the current template parser doesn't support the processUnmatched or unmached options !!!!
                // code_vars = parseTemplate(code_vars || '', codeInputs, { escapeString: false, unmached: 'undefined' });
                let code_body = config.data.javascript_code_body;
                if (config.data._templateVars) {
                    // code_body = parseTemplate(code_body, config.data._templateVars);
                    code_body = TemplateStringHelper.create(code_body).parse(config.data._templateVars).result;
                }
                const code = code_vars + '\n' + code_body;

                logger.debug(` Running code \n${code}\n`);

                const result: any = await axios.post(url, { code }).catch((error) => ({ error }));

                if (result.error) {
                    _error = result.error?.response?.data || result.error?.message || result.error.toString() || 'Unknown error';
                    logger.error(` Error running code \n${JSON.stringify(result.error, null, 2)}\n`);
                    Output = undefined; //prevents running next component if the code execution failed
                } else {
                    logger.debug(` Code result \n${JSON.stringify(result.data, null, 2)}\n`);
                    Output = result.data?.Output;
                }

                return { Output, _error, _debug: logger.output };
            }
            else {
                let awsAccessKeyId = SREConfig.env.AWS_LAMBDA_ACCESS_KEY_ID;
                let awsSecretAccessKey = SREConfig.env.AWS_LAMBDA_SECRET_ACCESS_KEY;
                let awsRegion = SREConfig.env.AWS_LAMBDA_REGION;

                if (config.data.access_key_id && config.data.secret_access_key && config.data.region) {
                    [awsAccessKeyId, awsSecretAccessKey] = await Promise.all([
                        VaultHelper.getTeamKey(this.extractKeyFromTemplateVar(config.data.access_key_id), agent?.teamId),
                        VaultHelper.getTeamKey(this.extractKeyFromTemplateVar(config.data.secret_access_key), agent?.teamId)
                    ]);
                    awsRegion = config.data.region;
                }
                const awsCredentials = {
                    accessKeyId: awsAccessKeyId,
                    secretAccessKey: awsSecretAccessKey,
                    region: awsRegion
                }

                let codeInputs = {};
                for (let fieldName in input) {
                    const _type = typeof input[fieldName];
                    switch (_type) {
                        case 'string':
                            codeInputs[fieldName] = `${input[fieldName]}`;
                            break;
                        case 'number':
                        case 'boolean':
                            codeInputs[fieldName] = input[fieldName];
                            break;
                        default:
                            codeInputs[fieldName] = input[fieldName];
                            break;
                    }
                }

                logger.debug(`\nInput Variables: \n${JSON.stringify(codeInputs, null, 2)}\n`);
                const functionName = this.getLambdaFunctionName(agent.id, config.id);
                const [isLambdaExists, exisitingCodeHash] = await Promise.all([
                    this.getDeployedFunction(functionName, awsCredentials),
                    this.getDeployedCodeHash(agent.id, config.id)
                ]);
                const codeHash = this.generateCodeHash(config?.data?.code_body, config?.data?.code_imports);

                if (!isLambdaExists || exisitingCodeHash !== codeHash) {
                    // Deploy lambda function
                    await this.deployServerlessCode({ agentId: agent.id, componentId: config.id, code_imports: config?.data?.code_imports, code_body: config?.data?.code_body, input_variables: Object.keys(codeInputs), awsConfigs: awsCredentials });
                }
                try {
                    const functionName = `${agent.id}-${config.id}`;
                    const result = await this.invokeLambdaFunction(functionName, codeInputs, awsCredentials);
                    await this.updateDeployedCodeTTL(agent.id, config.id, this.cacheTTL);
                    logger.debug(`Code result \n${JSON.stringify(result, null, 2)}\n`);
                    Output = result;

                } catch (error: any) {
                    logger.error(`Error running code \n${error}\n`);
                    _error = error?.response?.data || error?.message || error.toString();
                    Output = undefined; //prevents running next component if the code execution failed
                }
            }
            return { Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error running code \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    extractKeyFromTemplateVar(input: string) {
        const regex = /\{\{KEY\((.*?)\)\}\}/;
        const match = input.match(regex);
        return match ? match[1] : input;
    }

    async invokeLambdaFunction(
        functionName: string,
        inputs: { [key: string]: any },
        awsCredentials: AWSCredentials):
        Promise<any> {
        try {
            const client = new LambdaClient({
                region: awsCredentials.region as string,
                ...(awsCredentials.accessKeyId && {
                    credentials: {
                        accessKeyId: awsCredentials.accessKeyId as string,
                        secretAccessKey: awsCredentials.secretAccessKey as string
                    }
                })
            });

            const invokeCommand = new InvokeCommand({
                FunctionName: functionName,
                Payload: new TextEncoder().encode(`${JSON.stringify(inputs)}`),
                InvocationType: 'RequestResponse'
            })

            const response = await client.send(invokeCommand)
            if (response.FunctionError) {
                throw new Error(new TextDecoder().decode(response.Payload))
            }
            return new TextDecoder().decode(response.Payload);
        } catch (error) {
            throw error;
        }
    }

    private async getDeployedFunction(functionName: string, awsConfigs: AWSCredentials) {
        try {
            const client = new LambdaClient({
                region: awsConfigs.region,
                credentials: {
                    accessKeyId: awsConfigs.accessKeyId,
                    secretAccessKey: awsConfigs.secretAccessKey
                }
            });
            const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName })
            const lambdaResponse = await client.send(getFunctionCommand);
            return {
                status: lambdaResponse.Configuration.LastUpdateStatus,
                functionName: lambdaResponse.Configuration.FunctionName,
                functionVersion: lambdaResponse.Configuration.Version,
                updatedAt: lambdaResponse.Configuration.LastModified,
                role: lambdaResponse.Configuration.Role,
            };
        } catch (error) {
            return null;
        }
    }

    private getLambdaFunctionName(agentId: string, componentId: string) {
        return `${agentId}-${componentId}`;
    }

    private async deployServerlessCode({ agentId, componentId, code_imports, code_body, input_variables, awsConfigs }:
        {
            agentId: string, componentId: string, code_imports: string, code_body: string, input_variables: string[], awsConfigs: {
                region: string,
                accessKeyId: string,
                secretAccessKey: string
            }
        }): Promise<boolean> {
        const baseFolder = `${process.cwd()}/lambda_archives`;
        if (!fs.existsSync(baseFolder)) {
            fs.mkdirSync(baseFolder);
        }
        const folderName = this.getLambdaFunctionName(agentId, componentId);
        const directory = `${baseFolder}/${folderName}__${Date.now()}`;
        const codeHash = this.generateCodeHash(code_body, code_imports);
        try {
            const libraries = this.extractNpmImports(code_imports);

            const lambdaCode = this.generateLambdaCode(code_imports, code_body, input_variables);
            // create folder
            fs.mkdirSync(directory);
            // create index.js file
            fs.writeFileSync(path.join(directory, 'index.mjs'), lambdaCode);
            // run command npm init
            execSync('npm init -y', { cwd: directory });
            // run command npm install
            execSync(`npm install ${libraries.join(' ')}`, { cwd: directory });

            const zipFilePath = await this.zipCode(directory);
            await this.createOrUpdateLambdaFunction(folderName, zipFilePath, awsConfigs)
            await this.setDeployedCodeHash(agentId, componentId, codeHash);
            // console.log('Lambda function updated successfully!');
            return true;
        } catch (error) {
            throw error;
        } finally {
            fs.rmSync(`${directory}`, { recursive: true, force: true });
            fs.unlinkSync(`${directory}.zip`);
        }
    }

    private extractNpmImports(code_imports: string) {
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;

        let libraries = new Set();

        // Match require statements
        let match;
        while ((match = requireRegex.exec(code_imports)) !== null) {
            libraries.add(match[1]);
        }
        // Match import statements
        while ((match = importRegex.exec(code_imports)) !== null) {
            libraries.add(match[1]);
        }
        return Array.from(libraries);
    }

    private generateLambdaCode(code_imports: string, code_body: string, input_variables: string[]) {
        const lambdaCode = `${code_imports}\nexport const handler = async (event, context) => {
          try {
            context.callbackWaitsForEmptyEventLoop = false;
           ${input_variables && input_variables.length ? input_variables.map((variable) => `const ${variable} = event.${variable};`).join('\n') : ''}
        \n${code_body}
          } catch (e) {
            throw e;
          }
         };`;
        return lambdaCode;
    }

    private async zipCode(directory: string) {
        return new Promise((resolve, reject) => {
            zl.archiveFolder(directory, `${directory}.zip`).then(function () {
                resolve(`${directory}.zip`);
            }, function (err) {
                reject(err);
            });
        });
    }

    private async createOrUpdateLambdaFunction(functionName, zipFilePath, awsConfigs) {
        const client = new LambdaClient({
            region: awsConfigs.region,
            credentials: {
                accessKeyId: awsConfigs.accessKeyId,
                secretAccessKey: awsConfigs.secretAccessKey
            }
        });
        const functionContent = fs.readFileSync(zipFilePath);

        try {
            // Check if the function exists
            const exisitingFunction = await this.getDeployedFunction(functionName, awsConfigs);
            if (exisitingFunction) {
                if (exisitingFunction.status === 'InProgress') {
                    await this.verifyFunctionDeploymentStatus(functionName, client)
                }
                // Update function code if it exists
                const updateCodeParams = {
                    FunctionName: functionName,
                    ZipFile: functionContent,
                };
                const updateFunctionCodeCommand = new UpdateFunctionCodeCommand(updateCodeParams)
                await client.send(updateFunctionCodeCommand)
                // Update function configuration to attach layer
                await this.verifyFunctionDeploymentStatus(functionName, client)
                // console.log('Lambda function code and configuration updated successfully!');
            } else {
                // Create function if it does not exist
                let roleArn = '';
                // check if the role exists
                try {
                    const iamClient = new IAMClient({ region: awsConfigs.region, credentials: { accessKeyId: awsConfigs.accessKeyId, secretAccessKey: awsConfigs.secretAccessKey } });
                    const getRoleCommand = new GetRoleCommand({ RoleName: `smyth-${functionName}-role` });
                    const roleResponse = await iamClient.send(getRoleCommand);
                    roleArn = roleResponse.Role.Arn;
                } catch (error) {
                    if (error.name === 'NoSuchEntityException') {
                        // create role
                        const iamClient = new IAMClient({ region: awsConfigs.region, credentials: { accessKeyId: awsConfigs.accessKeyId, secretAccessKey: awsConfigs.secretAccessKey } });
                        const createRoleCommand = new CreateRoleCommand({ RoleName: `smyth-${functionName}-role`, AssumeRolePolicyDocument: this.getLambdaRolePolicy() });
                        const roleResponse = await iamClient.send(createRoleCommand);
                        await this.waitForRoleDeploymentStatus(`smyth-${functionName}-role`, iamClient)
                        roleArn = roleResponse.Role.Arn;
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
                        'auto-delete': 'true'
                    }
                };

                const functionCreateCommand = new CreateFunctionCommand(functionParams)
                const functionResponse = await client.send(functionCreateCommand)
                // console.log('Function ARN:', functionResponse.FunctionArn);
                await this.verifyFunctionDeploymentStatus(functionName, client)
            }
        } catch (error) {
            throw error;
        }
    }

    private async waitForRoleDeploymentStatus(roleName, client): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                let interval = setInterval(async () => {
                    const getRoleCommand = new GetRoleCommand({ RoleName: roleName })
                    const roleResponse = await client.send(getRoleCommand);
                    if (roleResponse.Role.AssumeRolePolicyDocument) {
                        clearInterval(interval)
                        return resolve(true);
                    }
                }, 7000);
            } catch (error) {
                return false;
            }
        })
    }

    private async verifyFunctionDeploymentStatus(functionName, client): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                let interval = setInterval(async () => {
                    const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName })
                    const lambdaResponse = await client.send(getFunctionCommand);

                    if (lambdaResponse.Configuration.LastUpdateStatus === 'Successful') {
                        clearInterval(interval)
                        return resolve(true);
                    }
                }, 5000);
            } catch (error) {
                return false;
            }
        })
    }

    private getLambdaRolePolicy() {
        return JSON.stringify(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "lambda.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            })
    }

    private generateCodeHash(code_body: string, code_imports: string) {
        const importsHash = this.getSanitizeCodeHash(code_imports);
        const bodyHash = this.getSanitizeCodeHash(code_body);
        return `imports-${importsHash}__body-${bodyHash}`;
    }

    private getSanitizeCodeHash(code: string) {
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

        return crypto.createHash("md5").update(output.replace(/\s+/g, ' ').trim()).digest("hex");
    }

    private async getDeployedCodeHash(agentId: string, componentId: string) {
        const redisCache = ConnectorService.getCacheConnector('Redis');
        const cachedCodeHash = await redisCache.user(AccessCandidate.agent(agentId)).get(`${this.cachePrefix}_${agentId}-${componentId}`);
        return cachedCodeHash;
    }

    private async setDeployedCodeHash(agentId: string, componentId: string, codeHash: string) {
        const redisCache = ConnectorService.getCacheConnector('Redis');
        await redisCache.user(AccessCandidate.agent(agentId)).set(`${this.cachePrefix}_${agentId}-${componentId}`, codeHash, null, null, this.cacheTTL);
    }

    private async updateDeployedCodeTTL(agentId: string, componentId: string, ttl: number) {
        const redisCache = ConnectorService.getCacheConnector('Redis');
        await redisCache.user(AccessCandidate.agent(agentId)).updateTTL(`${this.cachePrefix}_${agentId}-${componentId}`, ttl);
    }
}
