import { TLLMEvent, TLLMProvider } from '@smythos/sre';
import { ComponentWrapper } from '../components/ComponentWrapper.class';

export type InputSettings = {
    type: 'Text' | 'Number' | 'Boolean' | 'Object' | 'Array' | 'Any' | 'Binary';
    description?: string;
    optional?: boolean;
    default?: boolean;
};

export type ComponentInput = { source?: any; component?: ComponentWrapper } & InputSettings;

export type LLMEvent = TLLMEvent;

export { TLLMProvider };
