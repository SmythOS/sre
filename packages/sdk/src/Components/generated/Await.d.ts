import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TAwaitSettings {
    name?: string;
    /** Jobs Count */
    jobs_count?: number;
    /** Max time */
    max_time?: number;
}
export type TAwaitInputs = {
    [key: string]: InputSettings;
};
export type TAwaitOutputs = {
    [key: string]: any;
};
export declare function Await(settings?: TAwaitSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TAwaitOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TAwaitInputs) => void;
};
