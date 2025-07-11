//!!! DO NOT EDIT THIS FILE, IT IS AUTO-GENERATED !!!//

import { Agent } from '../../Agent/Agent.class';
import { createSafeAccessor } from '../utils';
import { ComponentWrapper } from '../ComponentWrapper.class';
import { InputSettings, ComponentInput } from '../../types/SDKTypes';

export interface TServerlessCodeSettings {
    name?: string;
    /** Imports */
    code_imports?: string;
    /** Code */
    code_body?: string;
    /** Code */
    code?: string;
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

export function ServerlessCode(settings?: TServerlessCodeSettings, agent?: Agent) {    
    const { name, ...settingsWithoutName } = settings || {};
    const dataObject: any = { 
        name: settings?.name || 'ServerlessCode', 
        settings: {
            ...settingsWithoutName 
        }
    };
    const component = new ComponentWrapper(dataObject, agent);

    if (agent) {
        (agent.structure.components as ComponentWrapper[]).push(component);
    }
    
    const _out: TServerlessCodeOutputs = createSafeAccessor({
        // No outputs defined
    }, component, '');

    const _in: { [key: string]: ComponentInput } = {
        // No inputs defined
    };

    dataObject.outputs = _out;
    dataObject.inputs = _in;

    component.inputs(_in);

    const wrapper = {
        /** Component outputs - access via .out.OutputName */
        out: _out,        

        /** 
         * Create or Connect the component inputs 
         * if the input does not exist, it will be created
         * @examples 
         *    - component.in({ Input: source.out.data })
         *    - component.in({ Input: { type: 'string', source:source.out.data } })
         */        
        in: component.inputs.bind(component) as (inputs: TServerlessCodeInputs) => void,
    };

    return wrapper;
}
