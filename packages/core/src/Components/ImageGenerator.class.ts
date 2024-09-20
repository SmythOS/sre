import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { GenerateImageConfig } from '@sre/types/LLM.types';

export default class ImageGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().valid('dall-e-2', 'dall-e-3').required(),
        sizeDalle2: Joi.string().valid('256x256', '512x512', '1024x1024').required(),
        sizeDalle3: Joi.string().valid('1024x1024', '1792x1024', '1024x1792').required(),
        quality: Joi.string().valid('standard', 'hd').required(),
        style: Joi.string().valid('vivid', 'natural').required(),
        isRawInputPrompt: Joi.boolean().strict(),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

        logger.debug(`=== Image Generator Log ===`);

        let model = config?.data?.model;

        if (!model) {
            return { _error: 'Model Not Found: Either DALL·E 3 or DALL·E 2 is required!', _debug: logger.output };
        }

        let prompt = typeof input?.Prompt === 'string' ? input?.Prompt : JSON.stringify(input?.Prompt);

        // ! LATER IMPROVEMENT: support image variation API
        /* let image = input?.Image || null;
        let shouldGenerateVariation = false;
        let tempImagePath = '';

        if (image) {
            const file = new SmythFile(image);
            image = await file.toFsReadStream();

            if (image) {
                shouldGenerateVariation = true;
                tempImagePath = image?.path;

                model = 'dall-e-2';
            }
        } */

        // ! LATER IMPROVEMENT: support image variation API
        // if (!prompt && !image)
        if (!prompt) {
            return { _error: 'Please provide a prompt or Image', _debug: logger.output };
        }

        let _finalPrompt = prompt;

        logger.debug(`Prompt: \n`, prompt);

        const responseFormat = config?.data?.responseFormat || 'url';

        let args: GenerateImageConfig = {
            response_format: responseFormat,
            model,
        };

        // ! LATER IMPROVEMENT: support image variation API
        /* if (shouldGenerateVariation) {
            args = {
                image,
                model,
                response_format: responseFormat,
            };
        } else {
            args = {
                prompt,
                model,
                response_format: responseFormat,
            };
        } */

        if (model === 'dall-e-3') {
            const size = config?.data?.sizeDalle3 || '1024x1024';
            const quality = config?.data?.quality || 'standard';
            const style = config?.data?.style || 'vivid';
            args.size = size;
            args.quality = quality;
            args.style = style;

            const isRawInputPrompt = config?.data?.isRawInputPrompt || false;

            if (isRawInputPrompt) {
                _finalPrompt = `I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: ${input?.Prompt}`;
            }
        } else if (model === 'dall-e-2') {
            const size = config?.data?.sizeDalle2 || '256x256';
            const numberOfImages = parseInt(config?.data?.numberOfImages) || 1;
            args.size = size;
            args.n = numberOfImages;
        }

        try {
            // ! LATER IMPROVEMENT: support image variation API
            /* if (shouldGenerateVariation) {
                response = await OpenAI.generateImageVariation(args);

                // remove temp image
                const removeFile = promisify(fs.unlink);
                removeFile(tempImagePath);
            } else {
                response = await OpenAI.generateImage(args);
            } */

            // let response = await OpenAI.generateImage(args);
            const llmInference: LLMInference = await LLMInference.load(model);

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }
            const response: any = await llmInference.imageGenRequest(_finalPrompt, args, agent).catch((error) => ({ error: error }));

            let output = response?.data?.[0]?.[responseFormat];
            const revised_prompt = response?.data?.[0]?.revised_prompt;

            if (revised_prompt && prompt !== revised_prompt) {
                logger.debug(`Revised Prompt:\n${revised_prompt}`);
            }

            logger.debug(`Output:`, output);

            return { Output: output, _debug: logger.output };
        } catch (error: any) {
            return { _error: `Generating Image(s)\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}
