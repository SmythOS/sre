import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TMCPClientSettings {
    model?: string;
    openAiModel: string;
    /** Description for Model */
    descForModel: string;
    name: string;
    /** Description */
    desc: string;
    logoUrl?: string;
    id?: string;
    version?: string;
    domain?: string;
    /** Prompt */
    prompt?: string;
}
export type TMCPClientInputs = {
    [key: string]: InputSettings;
};
export type TMCPClientOutputs = {
    [key: string]: any;
};
export declare function MCPClient(settings?: TMCPClientSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TMCPClientOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TMCPClientInputs) => void;
};
