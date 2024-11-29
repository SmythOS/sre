import 'source-map-support/register.js';
import AgentRequest from './subsystems/AgentManager/AgentRequest.class';
import AgentSettings from './subsystems/AgentManager/AgentSettings.class';
//import SRE from './Core/SRE.class';
import Agent from './subsystems/AgentManager/Agent.class';
import SmythRuntime from './Core/SmythRuntime.class';
import { boot } from './Core/boot';
import { ConnectorService } from './Core/ConnectorsService';
import { CLIAgentDataConnector } from './subsystems/AgentManager/AgentData.service/connectors/CLIAgentDataConnector.class';
import { AgentProcess } from './Core/AgentProcess.helper';
import { Conversation } from './helpers/Conversation.helper';
import config from './config';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
import { AgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';
import { LLMConnector } from '@sre/LLMManager/LLM.service/LLMConnector';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { CLIConnector } from '@sre/IO/CLI.service/CLIConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import SystemEvents from './Core/SystemEvents';
boot();

export {
    config,
    SmythRuntime,
    SystemEvents,
    Agent,
    AgentRequest,
    AgentSettings,
    AgentProcess,
    AccessCandidate,
    Conversation,
    ConnectorService,
    AccountConnector,
    StorageConnector,
    CacheConnector,
    AgentDataConnector,
    LLMConnector,
    VectorDBConnector,
    NKVConnector,
    CLIConnector,
    VaultConnector,
    CLIAgentDataConnector
};
