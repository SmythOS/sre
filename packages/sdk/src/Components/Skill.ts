import { Agent } from '../Agent/Agent.class';
import { createSafeAccessor } from './utils';
import { ComponentWrapper } from './ComponentWrapper.class';
import { InputSettings, ComponentInput } from '../types/SDKTypes';

function normalizeEndpointName(name: string) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
}

export type TSkillSettings = {
    name: string;
    endpoint?: string;
    status_message?: string;
    ai_exposed?: boolean;
    description?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    process?: (input?: any) => Promise<any>;
    inputs?: Record<string, { source: any } & InputSettings>;
};

export type TSkillInputs = {
    [key: string]: InputSettings;
};

export function Skill(settings?: TSkillSettings, agent?: Agent) {
    const { name, process, inputs, ...settingsWithoutName } = settings || {};
    const dataObject: any = {
        name: 'APIEndpoint',
        process,
        settings: {
            ...settingsWithoutName,
            endpoint: normalizeEndpointName(settings?.endpoint || settings?.name),
            status_message: settings?.status_message || '',
            ai_exposed: settings?.ai_exposed || true,
            method: settings?.method || 'POST',
        },
    };
    const component = new ComponentWrapper(dataObject, agent);

    if (agent) {
        agent.structure.components.push(component);
        agent.sync();
    }

    const _out: { headers: any; body: any; query: any; [key: string]: any } = createSafeAccessor(
        {
            headers: createSafeAccessor({}, component, 'headers'),
            body: createSafeAccessor({}, component, 'body'),
            query: createSafeAccessor({}, component, 'query'),
        },
        component,
        ''
    );

    const _in: { [key: string]: ComponentInput } = {};

    dataObject.outputs = _out;
    dataObject.inputs = _in;

    component.inputs(_in);
    component.outputPathRewrite = (path: string) => {
        if (!path.startsWith('body.')) {
            return `body.${path}`;
        }
        return path;
    };

    const wrapper = {
        out: _out,
        in: component.inputs.bind(component) as (inputs: TSkillInputs) => void,
    };

    return wrapper;
}
