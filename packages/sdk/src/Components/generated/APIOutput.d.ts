import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TAPIOutputSettings {
    name?: string;
    /** Output Format */
    format: 'full' | 'minimal' | 'raw';
    /** Content Type */
    contentType?: 'application/json' | 'text/plain' | 'text/html' | 'application/xml';
}
export type TAPIOutputInputs = {
    [key: string]: InputSettings;
};
export type TAPIOutputOutputs = {
    [key: string]: any;
};
export declare function APIOutput(settings?: TAPIOutputSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TAPIOutputOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TAPIOutputInputs) => void;
};
