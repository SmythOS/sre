import { SmythLLMUsage } from '@sre/types/LLM.types';
import { TServiceRegistry } from '@sre/types/SRE.types';
import { EventEmitter } from 'events';

export type SystemEventMap = {
    'SRE:Booted': [TServiceRegistry];
    'SRE:Initialized': [];
    'USAGE:LLM': [SmythLLMUsage];
    'USAGE:API': any;
};

const SystemEvents = new EventEmitter<SystemEventMap>();

export default SystemEvents;
