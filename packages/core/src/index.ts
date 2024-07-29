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

boot();

export { Agent, AgentRequest, AgentSettings, AgentProcess, SmythRuntime, Conversation, ConnectorService, CLIAgentDataConnector, config };
