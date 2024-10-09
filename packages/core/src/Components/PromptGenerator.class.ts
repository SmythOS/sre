import Agent from '@sre/AgentManager/Agent.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import Joi from 'joi';
import Component from './Component.class';

//TODO : better handling of context window exceeding max length

export default class PromptGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        prompt: Joi.string().required().label('Prompt'),
        temperature: Joi.number().min(0).max(5).label('Temperature'), // max temperature is 2 for OpenAI and togetherAI but 5 for cohere
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        stopSequences: Joi.string().allow('').max(400).label('Stop Sequences'),
        topP: Joi.number().min(0).max(1).label('Top P'),
        topK: Joi.number().min(0).max(500).label('Top K'), // max top_k is 100 for togetherAI but 500 for cohere
        frequencyPenalty: Joi.number().min(0).max(2).label('Frequency Penalty'),
        presencePenalty: Joi.number().min(0).max(2).label('Presence Penalty'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        //let debugLog = agent.agentRuntime?.debug ? [] : undefined;
        const logger = this.createComponentLogger(agent, config.name);

        try {
            logger.debug(`=== LLM Prompt Log ===`);

            const model: string = config.data.model || 'echo';
            const llmInference: LLMInference = await LLMInference.load(model, agent.teamId);

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            logger.debug(` Model : ${model}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            // with 'Echo' model we may have object as input
            if (prompt === '[object Object]') {
                prompt = TemplateString(config.data.prompt).parseRaw(input).result;
            }

            logger.debug(` Parsed prompt\n`, prompt, '\n');

            // request to LLM
            const response: any = await llmInference.promptRequest(prompt, config, agent).catch((error) => ({ error: error }));

            logger.debug(` Enhanced prompt \n`, prompt, '\n');
            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                logger.error(` LLM Error=${JSON.stringify(response.error)}`);

                return { Reply: response?.data, _error: response?.error + ' ' + (response?.details || ''), _debug: logger.output };
            }

            const result = { Reply: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
