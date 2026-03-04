import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CodeExecutionResult } from '@sre/ComputeManager/Code.service/CodeConnector';

export class ECMASandbox extends Component {
    protected configSchema = Joi.object({
        code: Joi.string().max(500000).allow('').label('Code'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            let Output: any = {};
            let _error = undefined;

            let codeInputs = {};
            for (let fieldName in input) {
                const _type = typeof input[fieldName];
                switch (_type) {
                    case 'string':
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

            //const inputVarsCode = this.generateInputVarCode(codeInputs);
            //const code = inputVarsCode + '\n' + config.data.code;
            const code = config.data.code;

            logger.debug(`Running code: \n${code}\n`);

            const ecmaCodeConnector = ConnectorService.getCodeConnector('ECMASandbox');

            const executionResponse: CodeExecutionResult = await ecmaCodeConnector.agent(agent.id).execute(config.id, { code, inputs: input });
            if (executionResponse.success) {
                Output = executionResponse.output;
            } else {
                Output = undefined;
                _error = executionResponse.errors;
            }

            return { Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(`Error running code: \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    private generateInputVarCode(input: Record<string, any>) {
        let input_vars = '';
        for (const key in input) {
            input_vars += `var ${key} = ${input[key]};\n`;
        }
        return input_vars;
    }
}
