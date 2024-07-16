import { AgentDataService } from '@sre/AgentManager/AgentData.service';
import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { AccountService } from '@sre/Security/Account.service';
import { VaultService } from '@sre/Security/Vault.service';

export type TServiceRegistry = {
    Storage?: StorageService;
    Cache?: CacheService;
    LLM?: LLMService;
    Vault?: VaultService;
    Account?: AccountService;
    AgentData?: AgentDataService;
};

export enum TConnectorService {
    Storage = 'Storage',
    Cache = 'Cache',
    LLM = 'LLM',
    Vault = 'Vault',
    Account = 'Account',
    AgentData = 'AgentData',
}

export type SREConnectorConfig = {
    Connector: string;
    Default?: boolean;
    Settings?: {
        [hashedOwnerKey: string]: any;
    };
};

export type SREConfig = {
    [key in TConnectorService]?: SREConnectorConfig[] | SREConnectorConfig;
};
