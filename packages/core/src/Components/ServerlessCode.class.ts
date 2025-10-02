import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AWSCredentials, AWSRegionConfig } from '@sre/types/AWS.types';
import { calculateExecutionCost, generateCodeFromLegacyComponent, getLambdaCredentials, reportUsage } from '@sre/helpers/AWSLambdaCode.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export class ServerlessCode extends Component {

    protected configSchema = Joi.object({
        code_imports: Joi.string().max(1000).allow('').label('Imports'),
        code_body: Joi.string().max(500000).allow('').label('Code'),
        code: Joi.string().max(500000).allow('').label('Code').optional(),
        deploy_btn: Joi.string().max(500000).allow('').label('Deploy').optional(),
        accessKeyId: Joi.string().max(100).allow('').label('AWS Access Key ID').optional(),
        secretAccessKey: Joi.string().max(200).allow('').label('AWS Secret Access Key').optional(),
        region: Joi.string().label('AWS Region').optional(),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
        function_label: Joi.string().max(100).allow('').label('Function Label').optional(),
        function_label_end: Joi.string().allow(null).label('Function Label End').optional(),
        use_own_keys: Joi.boolean().label('Use Own Keys').optional(),
        pricing_note: Joi.string().allow(null).label('Pricing Note').optional(),
    });
    constructor() {
        super();
    }
    init() { }

    async process(input, config, agent: Agent) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            logger.debug(`=== Serverless Code Log ===`);
            let Output: any = {};
            let _error = undefined;
            const componentInputs = agent.components[config.id]?.inputs || {};

            let codeInputs = {};
            for (let field of componentInputs) {
                const _type = typeof input[field.name];
                switch (_type) {
                    case 'string':
                        try {
                            codeInputs[field.name] = JSON.parse(input[field.name].replace(/\\"/g, '"'));
                        } catch (error) {
                            codeInputs[field.name] = `${input[field.name]}`;
                        }
                        break;
                    case 'number':
                    case 'boolean':
                        codeInputs[field.name] = input[field.name];
                        break;
                    default:
                        codeInputs[field.name] = input[field.name];
                        break;
                }
            }

            logger.debug(`\nInput Variables: \n${JSON.stringify(codeInputs, null, 2)}\n`);

            let codeConnector = ConnectorService.getCodeConnector();
            let codeCredentials: AWSCredentials & AWSRegionConfig & { isUserProvidedKeys: boolean } =
                await getLambdaCredentials(agent, config);

            if (codeCredentials.isUserProvidedKeys) {
                codeConnector = codeConnector.instance({
                    region: codeCredentials.region,
                    accessKeyId: codeCredentials.accessKeyId,
                    secretAccessKey: codeCredentials.secretAccessKey,
                })
            }
            let code = config?.data?.code;
            if (!code) {
                code = generateCodeFromLegacyComponent(config.data.code_body, config.data.code_imports, Object.keys(codeInputs))
            }
            // Deploy lambda function if it doesn't exist or the code hash is different
            await codeConnector.agent(agent.id)
                .deploy(config.id, {
                    code,
                    inputs: codeInputs,
                }, {
                    runtime: 'nodejs',
                });

            try {
                const executionResponse = await codeConnector.agent(agent.id).execute(config.id, codeInputs);
                const executionTime = executionResponse.executionTime;
                logger.debug(
                    `Code result:\n ${typeof executionResponse.output === 'object' ? JSON.stringify(executionResponse.output, null, 2) : executionResponse.output
                    }\n`,
                );
                logger.debug(`Execution time: ${executionTime}ms\n`);

                const cost = calculateExecutionCost(executionTime);
                if (!codeCredentials.isUserProvidedKeys) {
                    const accountConnector = ConnectorService.getAccountConnector();
                    const agentTeam = await accountConnector.getCandidateTeam(AccessCandidate.agent(agent.id));
                    reportUsage({ cost, agentId: agent.id, teamId: agentTeam });
                }

                if (executionResponse.success) {
                    Output = executionResponse.output;
                } else {
                    Output = undefined;
                    _error = executionResponse.errors;
                }
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
}
