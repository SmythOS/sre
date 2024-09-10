import axios from 'axios';
import Component from './Component.class';
import Agent from '@sre/AgentManager/Agent.class';
import Joi from 'joi';
import { TemplateStringHelper } from '@sre/helpers/TemplateString.helper';

function validateAndParseJson(value, helpers) {
    let parsedJson: any = null;

    // Try parsing the JSON string
    try {
        parsedJson = JSON.parse(value);
    } catch (error) {
        // If parsing fails, return an error
        return helpers.error('string.invalidJson', { value });
    }

    // Check if the result is an object
    if (typeof parsedJson !== 'object' || parsedJson === null) {
        return helpers.error('string.notJsonObject', { value });
    }

    // Check for empty keys
    for (const key in parsedJson) {
        if (key.trim() === '') {
            return helpers.error('object.emptyKey', { value });
        }
    }

    // Return the parsed JSON if all validations pass
    return parsedJson;
}

export default class ZapierAction extends Component {
    protected configSchema = Joi.object({
        actionName: Joi.string().max(100).required(),
        actionId: Joi.string().max(100).required(),
        logoUrl: Joi.string().max(500).allow(''),
        apiKey: Joi.string().max(350).required(),
        params: Joi.string().custom(validateAndParseJson, 'custom JSON validation').allow(''),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

        logger.debug(`=== Zapier Action Log ===`);

        const teamId = agent?.teamId;
        // const apiKey = await parseKey(config?.data?.apiKey, teamId);
        const apiKey = await TemplateStringHelper.create(config?.data?.apiKey).parseTeamKeys(teamId).asyncResult;

        if (!apiKey) {
            return { _error: 'You are not authorized to run the Zapier Action!', _debug: logger.output };
        }

        const actionId = config?.data?.actionId;

        if (!actionId) {
            return { _error: 'Zapier Action ID is required!', _debug: logger.output };
        }

        if (!Object.keys(input || {})?.length) {
            return { _error: 'Give a plain english description of exact action you want to do!', _debug: logger.output };
        }

        let _input = {};

        for (const [key, value] of Object.entries(input)) {
            // TODO: handle SmythFileObject in SRE context
            /*
            PROBLEM:
            in SRE context, if the passed input is a file, it will be an object with a url property with
            something like smythfs://teamId.team/candidateId/..., correct?
            the problem now is that, the zapier action expects a public url and not an INTERNAL private resource.

            Solutions I thought of:
            - pass a base64 
            */
            // if (isSmythFileObject(value)) {
            //     _input[key] = (value as SmythFileObject)?.url;
            // } else {
            _input[key] = value;
            // }
        }

        try {
            const url = `https://actions.zapier.com/api/v1/exposed/${actionId}/execute/?api_key=${apiKey}`;
            const res = await axios.post(url, { ..._input });

            logger.debug(`Output:\n`, res?.data);

            return { Output: res?.data, _debug: logger.output };
        } catch (error: any) {
            console.log('Error Running Zapier Action: \n', error);

            // Sometimes 'error?.response?.data' is an empty Object then we need to use 'error?.message'
            let message = Object.keys(error?.response?.data || {})?.length ? error?.response?.data : error?.message;

            if (typeof message === 'object') message = JSON.stringify(message);

            logger.error(`Error running Zapier Action!`, message);
            logger.error('Error Inputs ', input);

            return { _error: `Zapier Error: ${message}`, _debug: logger.output };
        }
    }
}
