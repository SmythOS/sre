import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from './Component.class';
import axios from 'axios';
import Joi from 'joi';
import _config from '@sre/config';
import { TemplateStringHelper } from '@sre/helpers/TemplateString.helper';

export class Code extends Component {
    protected configSchema = Joi.object({
        code_vars: Joi.string().max(1000).allow('').label('Variables'),
        code_body: Joi.string().max(500000).allow('').label('Code'),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
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
            let code_vars = TemplateStringHelper.create(config.data.code_vars || '')
                .parse(codeInputs)
                .clean(undefined, 'undefined').result;

            //TODO: the current template parser doesn't support the processUnmatched or unmached options !!!!
            // code_vars = parseTemplate(code_vars || '', codeInputs, { escapeString: false, unmached: 'undefined' });
            let code_body = config.data.code_body;
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
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error running code \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }
}

export default Code;
