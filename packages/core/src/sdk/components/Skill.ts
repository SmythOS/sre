import { AgentMaker, createSafeAccessor, ComponentWrapper } from '../sdk.index';
import { InputSettings, ComponentInput } from '../types/SDKTypes';

function normalizeEndpointName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
}

export type TSkillSettings = {
    name: string;
    endpoint?: string;
    ai_exposed?: boolean;
    description?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    process?: (input: any) => Promise<any>;
    inputs?: Record<string, { source: any } & InputSettings>;
};

export type TSkillInputs = {
    [key: string]: any;
};

export function Skill(settings?: TSkillSettings, agentMaker?: AgentMaker) {
    const { name, process, inputs, ...settingsWithoutName } = settings || {};
    const dataObject: any = {
        name: 'APIEndpoint',
        settings: {
            ...settingsWithoutName,
            endpoint: normalizeEndpointName(settings?.endpoint || settings?.name),
            ai_exposed: settings?.ai_exposed || true,
            method: settings?.method || 'POST',
        },
    };
    const component = new ComponentWrapper(dataObject, agentMaker);

    if (agentMaker) {
        agentMaker.structure.components.push(component);
    }

    const _out: { headers: any; body: any; query: any; [key: string]: any } = {
        headers: createSafeAccessor({}, component, 'headers'),
        body: createSafeAccessor({}, component, 'body'),
        query: createSafeAccessor({}, component, 'query'),
    };

    const _in: { [key: string]: ComponentInput } = {};

    dataObject.outputs = _out;
    dataObject.inputs = _in;

    component.inputs(_in);

    const wrapper = {
        out: _out,
        in: component.inputs.bind(component) as (inputs: TSkillInputs) => void,
    };

    return wrapper;
}
