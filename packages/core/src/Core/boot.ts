import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import { SystemEvents } from './SystemEvents';
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
import { ManagedVaultService } from '@sre/Security/ManagedVault.service';
import { LogService } from '@sre/ObservabilityManager/Log.service';
import { ComponentService } from '@sre/AgentManager/Component.service';
import { ModelsProviderService } from '@sre/LLMManager/ModelsProvider.service';
import { CodeService } from '@sre/ComputeManager/Code.service';
import { SchedulerService } from '@sre/AgentManager/Scheduler.service';
const console = Logger('Boot');
let _booted = false;
export function boot() {
    if (_booted) {
        console.warn('SRE already booted');
        return;
    }
    _booted = true;
    SystemEvents.emit('SRE:BootStart');
    console.debug('SRE Boot sequence started');
    const service: TServiceRegistry = {};
    service.NKV = new NKVService();
    service.Account = new AccountService();
    service.Vault = new VaultService();
    service.ManagedVault = new ManagedVaultService();
    service.Cache = new CacheService();
    service.Storage = new StorageService();
    service.ModelsProvider = new ModelsProviderService();
    service.LLM = new LLMService();
    service.AgentData = new AgentDataService();
    service.CLI = new CLIService();
    service.VectorDB = new VectorDBService();
    service.Router = new RouterService();
    service.Log = new LogService();
    service.Component = new ComponentService();
    service.Code = new CodeService();
    service.Scheduler = new SchedulerService();

    SystemEvents.on('SRE:Initialized', () => {
        console.debug('SRE Initialized');
        for (let key in service) {
            service[key].init();
        }

        SystemEvents.emit('SRE:Booted', service);

        console.debug('SRE Boot sequence completed');
    });
}
