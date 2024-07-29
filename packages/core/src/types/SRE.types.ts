import { AgentDataService } from '@sre/AgentManager/AgentData.service';
import { CLIService } from '@sre/IO/CLI.service';
import { NKVService } from '@sre/IO/NKV.service';
import { StorageService } from '@sre/IO/Storage.service';
import { VectorDBService } from '@sre/IO/VectorDB.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { AccountService } from '@sre/Security/Account.service';
import { VaultService } from '@sre/Security/Vault.service';

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
