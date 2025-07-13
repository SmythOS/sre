import { Agent } from '../Agent/Agent.class';
import { InputSettings } from '../types/SDKTypes';
export type TSkillSettings = {
    name: string;
    endpoint?: string;
    ai_exposed?: boolean;
    description?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    process?: (input?: any) => Promise<any>;
    inputs?: Record<string, {
        source: any;
    } & InputSettings>;
};
export type TSkillInputs = {
    [key: string]: InputSettings;
};
export declare function Skill(settings?: TSkillSettings, agent?: Agent): {
    out: {
        [key: string]: any;
        headers: any;
        body: any;
        query: any;
    };
    in: (inputs: TSkillInputs) => void;
};
