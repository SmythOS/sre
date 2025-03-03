import Joi from 'joi';

export const ImageSettingsConfig = {
    model: Joi.string().max(100).required(),

    positivePrompt: Joi.string().required().min(2).max(2000).label('Positive Prompt'),
    negativePrompt: Joi.string().optional().allow('').min(2).max(2000).label('Negative Prompt'),

    width: Joi.number().min(128).max(2048).multiple(64).optional().messages({
        'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
    }),
    height: Joi.number().min(128).max(2048).multiple(64).optional().messages({
        'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
    }),

    outputFormat: Joi.string().valid('JPG', 'PNG', 'WEBP').optional(),
    outputQuality: Joi.number().min(20).max(99).optional().label('Output Quality'),

    numberResults: Joi.number().min(1).max(20).optional().label('Number of Results'),
    steps: Joi.number().min(0).max(100).optional().label('Strength'),

    backgroundColor: Joi.array()
        .items(
            Joi.number()
                .when('$index', {
                    is: 3, // when it's the alpha channel (4th item)
                    then: Joi.number().min(0).max(1), // alpha validation
                    otherwise: Joi.number().min(0).max(255).integer(), // RGB validation
                })
                .required()
        )
        .length(4)
        .optional()
        .allow('')
        .label('Background Color')
        .description('RGBA color array [red, green, blue, alpha]. RGB values must be between 0-255, alpha must be between 0-1'),

    strength: Joi.number().min(0).max(1).optional().label('Strength'),
    upscaleFactor: Joi.number().min(2).max(4).optional().label('Upscale Factor'),
    confidence: Joi.number().min(0).max(1).optional().label('Confidence'),
    maxDetections: Joi.number().min(1).max(20).optional().label('Max Detections'),
    maskPadding: Joi.number()
        .min(0)
        .max(100) // Guessed max value
        .optional()
        .label('Mask Padding'),
    maskBlur: Joi.number()
        .min(0)
        .max(100) // Guessed max value
        .optional()
        .label('Mask Blur'),
    preProcessorType: Joi.string()
        .valid('canny', 'depth', 'mlsd', 'normalbae', 'openpose', 'tile', 'seg', 'lineart', 'lineart_anime', 'shuffle', 'scribble', 'softedge')
        .optional()
        .label('Pre-Processor Type'),
    ipAdapters: Joi.array()
        .items(
            Joi.object({
                model: Joi.string().required().label('IP Adapter Model'),
                guideImage: Joi.string()
                    .required()
                    .min(2)
                    .max(10_485_760) // Approximately 10MB in base64
                    .label('Guide Image'),
                weight: Joi.number().required().min(0).max(1).label('IP Adapter Weight'),
            })
        )
        .optional()
        .label('IP Adapters'),
};
