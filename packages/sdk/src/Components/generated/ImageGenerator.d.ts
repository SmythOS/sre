import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TImageGeneratorSettings {
    name?: string;
    model: string;
    /** Prompt */
    prompt?: string;
    sizeDalle2?: '256x256' | '512x512' | '1024x1024';
    sizeDalle3?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd' | 'auto' | 'high' | 'medium' | 'low';
    style?: 'vivid' | 'natural';
    isRawInputPrompt?: boolean;
    /** Negative Prompt */
    negativePrompt?: string;
    width?: number;
    height?: number;
    outputFormat?: 'PNG' | 'JPEG' | 'WEBP' | 'auto' | 'jpeg' | 'png' | 'webp';
    /** Size */
    size?: string;
}
export type TImageGeneratorInputs = {
    [key: string]: InputSettings;
};
export type TImageGeneratorOutputs = {
    [key: string]: any;
};
export declare function ImageGenerator(settings?: TImageGeneratorSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TImageGeneratorOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TImageGeneratorInputs) => void;
};
