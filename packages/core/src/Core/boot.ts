import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import SystemEvents from './SystemEvents';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { Logger } from '../helpers/Log.helper';
import { TServiceRegistry } from '@sre/types/SRE.types';
import { VaultService } from '@sre/Security/Vault.service';
import { AccountService } from '@sre/Security/Account.service';
import { AgentDataService } from '@sre/AgentManager/AgentData.service';
import { VectorDBService } from '@sre/IO/VectorDB.service';
import { CLIService } from '@sre/IO/CLI.service';
import { NKVService } from '@sre/IO/NKV.service';
import { RouterService } from '@sre/IO/Router.service';
const console = Logger('Boot');

export function boot() {
    console.debug('SRE Boot sequence started');
    const service: TServiceRegistry = {};
    service.NKV = new NKVService();
    service.Account = new AccountService();
    service.Storage = new StorageService();
    service.Cache = new CacheService();
    service.LLM = new LLMService();
    service.Vault = new VaultService();
    service.AgentData = new AgentDataService();
    service.CLI = new CLIService();
    service.VectorDB = new VectorDBService();
    service.Router = new RouterService();

    SystemEvents.on('SRE:Initialized', () => {
        console.debug('SRE Initialized');
        for (let key in service) {
            service[key].init();
        }

        SystemEvents.emit('SRE:Booted', service);

        console.debug('SRE Boot sequence completed');
    });
}
