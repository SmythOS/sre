import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TServerlessCodeSettings {
    name?: string;
    /** Imports */
    code_imports?: string;
    /** Code */
    code_body?: string;
    /** Deploy */
    deploy_btn?: string;
    /** AWS Access Key ID */
    accessKeyId?: string;
    /** AWS Secret Access Key */
    secretAccessKey?: string;
    /** AWS Region */
    region?: string;
    /** Function Label */
    function_label?: string;
    /** Function Label End */
    function_label_end?: string;
    /** Use Own Keys */
    use_own_keys?: boolean;
    /** Pricing Note */
    pricing_note?: string;
}
export type TServerlessCodeInputs = {
    [key: string]: InputSettings;
};
export type TServerlessCodeOutputs = {
    [key: string]: any;
};
export declare function ServerlessCode(settings?: TServerlessCodeSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TServerlessCodeOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TServerlessCodeInputs) => void;
};
