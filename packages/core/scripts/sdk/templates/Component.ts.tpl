import { AgentMaker, ComponentWrapper, createSafeAccessor } from '../../sdk.index';
import { ComponentInput } from '../../types/SDKTypes';

{{settingsType}}

{{inputsType}}

export function {{componentName}}(settings?: T{{componentName}}Settings, agentMaker?: AgentMaker) {    
    const { name, ...settingsWithoutName } = settings || {};
    const dataObject: any = { 
        name: settings?.name || '{{componentName}}', 
        settings: {
            ...settingsWithoutName 
        }
    };
    const component = new ComponentWrapper(dataObject, agentMaker);

    if (agentMaker) {
        agentMaker.structure.components.push(component);
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
        out: _out,        
        in: component.inputs.bind(component) as (inputs: T{{componentName}}Inputs) => void,
    };

    return wrapper;
}
