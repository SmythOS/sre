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
import { LogConnector } from '@sre/IO/Log.service/LogConnector';
import { TemplateString as TemplateStringHelper } from '@sre/helpers/TemplateString.helper';
import { JSONContent as JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { default as AgentLogger } from '@sre/AgentManager/AgentLogger.class';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';
import { ILLMContextStore } from '@sre/types/LLM.types';
import { APIKeySource } from '@sre/types/LLM.types';
import { version } from '../package.json';
import Component from './Components/Component.class';
import { ComponentConnector } from '@sre/AgentManager/Component.service/ComponentConnector';
import { HookService } from './Core/HookService';
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
    LogConnector,
    ComponentConnector,
    CLIAgentDataConnector,
    TemplateStringHelper,
    JSONContentHelper,
    Logger,
    AgentLogger,
    LLMRegistry,
    CustomLLMRegistry,
    APIKeySource,
    version,
    Component,
    HookService,
    // Interfaces: we must use the type-only export syntax when re-exporting interfaces
    type ILLMContextStore,
};
