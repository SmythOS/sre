import { Agent } from '../../Agent.class';
import { createSafeAccessor } from '../utils';
import { ComponentWrapper } from '../ComponentWrapper.class';
import { InputSettings, ComponentInput } from '../../types/SDKTypes';

{{settingsType}}

{{inputsType}}

export function {{componentName}}(settings?: T{{componentName}}Settings, agent?: Agent) {    
    const { name, ...settingsWithoutName } = settings || {};
    const dataObject: any = { 
        name: settings?.name || '{{componentName}}', 
        settings: {
            ...settingsWithoutName 
        }
    };
    const component = new ComponentWrapper(dataObject, agent);

    if (agent) {
        agent.structure.components.push(component);
    }
    
    const _out: {{outputsType}} = {
{{outputsCode}}
    };

    const _in: { [key: string]: ComponentInput } = {
{{inputsCode}}
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
        in: component.inputs.bind(component) as (inputs: T{{componentName}}Inputs) => void,
    };

    return wrapper;
}
