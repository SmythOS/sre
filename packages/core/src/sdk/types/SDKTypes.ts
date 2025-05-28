import { ComponentWrapper } from '../sdk.index';

export type InputSettings = {
    type: 'Text' | 'Number' | 'Boolean' | 'Object' | 'Array' | 'Any' | 'Binary';
    description?: string;
    optional?: boolean;
    default?: boolean;
};

export type ComponentInput = { source?: any; component?: ComponentWrapper } & InputSettings;
