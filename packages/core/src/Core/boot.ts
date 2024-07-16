import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import SystemEvents from './SystemEvents';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { createLogger } from './Logger';
import { TServiceRegistry } from '@sre/types/SRE.types';
import { VaultService } from '@sre/Security/Vault.service';
import { AccountService } from '@sre/Security/Account.service';
import { AgentDataService } from '@sre/AgentManager/AgentData.service';
const console = createLogger('Boot');

export function boot() {
    console.debug('SRE Boot sequence started');
    const service: TServiceRegistry = {};
    service.Storage = new StorageService();
    service.Cache = new CacheService();
    service.LLM = new LLMService();
    service.Vault = new VaultService();
    service.Account = new AccountService();
    service.AgentData = new AgentDataService();

    SystemEvents.on('SRE:Initialized', () => {
        console.debug('SRE Initialized');
        for (let key in service) {
            service[key].init();
        }

        SystemEvents.emit('SRE:Booted', service);

        console.debug('SRE Boot sequence completed');
    });
}
