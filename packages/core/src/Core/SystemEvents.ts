import { SmythLLMUsage, SmythTaskUsage } from '@sre/types/LLM.types';
import { TServiceRegistry } from '@sre/types/SRE.types';
import { EventEmitter } from 'events';
import { ExternalEventsReceiver } from './ExternalConnectorServer';

export type SystemEventMap = {
    'SRE:BootStart': [];
    'SRE:Booted': [TServiceRegistry];
    'SRE:Initialized': [any?];
    'USAGE:LLM': [SmythLLMUsage];
    'USAGE:API': any;
    'USAGE:TASK': [SmythTaskUsage];
    // External connector events (EXT:<connector-name>)
    [key: `EXT:${string}`]: [any];
};

const SystemEvents = new EventEmitter<SystemEventMap>();

// Create server instance
const server = new ExternalEventsReceiver({
    port: 8080,
    authTokens: ['your-secret-token'],
});

export { SystemEvents };
