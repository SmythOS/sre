import { Agent } from '../../Agent/Agent.class';
export interface TClassifierSettings {
    name?: string;
    model: string;
    /** Prompt */
    prompt?: string;
}
export type TClassifierInputs = {
    Input?: any;
    [key: string]: any;
};
export type TClassifierOutputs = {
    [key: string]: any;
};
export declare function Classifier(settings?: TClassifierSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TClassifierOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TClassifierInputs) => void;
};
