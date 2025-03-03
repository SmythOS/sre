import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import _config from '@sre/config';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';


export default class ServerlessCode extends Component {
    protected configSchema = Joi.object({
        code_imports: Joi.string().max(1000).allow('').label('Imports'),
        code_body: Joi.string().max(500000).allow('').label('Code'),
        deploy_btn: Joi.string().max(500000).allow('').label('Deploy'),
        accessKeyId: Joi.string().max(100).allow('').label('AWS Access Key ID'),
        secretAccessKey: Joi.string().max(200).allow('').label('AWS Secret Access Key'),
        region: Joi.string().label('AWS Region'),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
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
            const awsAccessKeyId = await VaultHelper.getTeamKey(this.extractKeyFromTemplateVar(config.data.accessKeyId), agent?.teamId);
            const awsSecretAccessKey = await VaultHelper.getTeamKey(this.extractKeyFromTemplateVar(config.data.secretAccessKey), agent?.teamId);
            const awsRegion = config.data.region;
            const awsCredentials = {
                ...(awsAccessKeyId && { accessKeyId: awsAccessKeyId }),
                ...(awsSecretAccessKey && { secretAccessKey: awsSecretAccessKey }),
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

            try {
                const functionName = `${agent.id}-${config.id}`;
                const result = await this.invokeLambdaFunction(functionName, codeInputs, awsCredentials);
                logger.debug(`Code result \n${JSON.stringify(result, null, 2)}\n`);
                Output = result;

            } catch (error: any) {
                logger.error(`Error running code \n${error}\n`);
                _error = error?.response?.data || error?.message || error.toString();
                Output = undefined; //prevents running next component if the code execution failed
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
        awsCredentials: { accessKeyId: string, secretAccessKey: string, region: string }):
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
}