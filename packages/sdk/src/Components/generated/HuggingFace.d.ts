import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface THuggingFaceSettings {
    /** Access Token */
    accessToken: string;
    modelName: string;
    modelTask: string;
    inputConfig?: string;
    parameters?: string;
    name: string;
    displayName: string;
    desc: string;
    logoUrl?: string;
    disableCache?: boolean;
}
export type THuggingFaceInputs = {
    [key: string]: InputSettings;
};
export type THuggingFaceOutputs = {
    [key: string]: any;
};
export declare function HuggingFace(settings?: THuggingFaceSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: THuggingFaceOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: THuggingFaceInputs) => void;
};
