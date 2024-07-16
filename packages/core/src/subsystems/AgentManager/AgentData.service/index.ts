//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { CLIAgentDataConnector } from './connectors/CLIAgentDataConnector.class';
import { AgentDataConnector } from './AgentDataConnector';

export class AgentDataService extends ConnectorServiceProvider {
    public register() {
        //FIXME : register an actual account connector, not the abstract one
        ConnectorService.register(TConnectorService.AgentData, 'AgentData', AgentDataConnector);
        ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
    }
}
