import { AgentDataService } from '@sre/AgentManager/AgentData.service';
import { CLIService } from '@sre/IO/CLI.service';
import { NKVService } from '@sre/IO/NKV.service';
import { StorageService } from '@sre/IO/Storage.service';
import { VectorDBService } from '@sre/IO/VectorDB.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { AccountService } from '@sre/Security/Account.service';
import { VaultService } from '@sre/Security/Vault.service';
import { RouterService } from '@sre/IO/Router.service';
import { ManagedVaultService } from '@sre/Security/ManagedVault.service';
import { LogService } from '@sre/ObservabilityManager/Log.service';
import { ComponentService } from '@sre/AgentManager/Component.service';
import { ModelsProviderService } from '@sre/LLMManager/ModelsProvider.service';
import { CodeService } from '@sre/ComputeManager/Code.service';
import { SchedulerService } from '@sre/AgentManager/Scheduler.service';
import { TelemetryService } from '@sre/ObservabilityManager/Telemetry.service';

export type TServiceRegistry = {
    Storage?: StorageService;
    VectorDB?: VectorDBService;
    Cache?: CacheService;
    LLM?: LLMService;
    Vault?: VaultService;
    Account?: AccountService;
    AgentData?: AgentDataService;
    CLI?: CLIService;
    NKV?: NKVService;
    Router?: RouterService;
    ManagedVault?: ManagedVaultService;
    Log?: LogService;
    Component?: ComponentService;
    ModelsProvider?: ModelsProviderService;
    Code?: CodeService;
    Scheduler?: SchedulerService;
    Telemetry?: TelemetryService;
};

export enum TConnectorService {
    Storage = 'Storage',
    VectorDB = 'VectorDB',
    Cache = 'Cache',
    LLM = 'LLM',
    Vault = 'Vault',
    Account = 'Account',
    AgentData = 'AgentData',
    CLI = 'CLI',
    NKV = 'NKV',
    Router = 'Router',
    ManagedVault = 'ManagedVault',
    Log = 'Log',
    Component = 'Component',
    ModelsProvider = 'ModelsProvider',
    Code = 'Code',
    Scheduler = 'Scheduler',
    Telemetry = 'Telemetry',
}

export type SREConnectorConfig = {
    Connector: string;
    Id?: string;
    Default?: boolean;
    Settings?: {
        [hashedOwnerKey: string]: any;
    };
};

export type SREConfig = {
    [key in TConnectorService]?: SREConnectorConfig[] | SREConnectorConfig | {};
};
