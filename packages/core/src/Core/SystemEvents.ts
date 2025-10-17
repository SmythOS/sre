import { SmythLLMUsage, SmythTaskUsage } from '@sre/types/LLM.types';
import { TServiceRegistry } from '@sre/types/SRE.types';
import { EventEmitter } from 'events';
import { ExternalEventsReceiver } from './ExternalEventsReceiver';
import { createHash } from 'crypto';
import { Logger } from '../helpers/Log.helper';

const logger = Logger('SystemEvents');

export type SystemEventMap = {
    'SRE:BootStart': [];
    'SRE:Booted': [TServiceRegistry];
    'SRE:Initialized': [any?];
    'USAGE:LLM': [SmythLLMUsage];
    'USAGE:API': any;
    'USAGE:TASK': [SmythTaskUsage];
};

const SystemEvents = new EventEmitter<SystemEventMap>();

// if (process.env?.SRE_SECRET?.trim()) {
//     const secretHash = createHash('md5').update(process.env.SRE_SECRET).digest('hex');
//     // Create server instance
//     new ExternalEventsReceiver({
//         port: process.env.SRE_PORT ? parseInt(process.env.SRE_PORT) : 55555,
//         authTokens: [secretHash],
//     });
// } else {
//     logger.warn('SRE_SECRET is not set, external events receiver will not be started');
// }

export { SystemEvents };
