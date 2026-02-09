//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { CLIAgentDataConnector } from './connectors/CLIAgentDataConnector.class';
import { AgentDataConnector } from './AgentDataConnector';
import { LocalAgentDataConnector } from './connectors/LocalAgentDataConnector.class';
import { NullAgentData } from './connectors/NullAgentData.class';
import { SQLiteAgentDataConnector } from './connectors/SQLiteAgentDataConnector.class';
export class AgentDataService extends ConnectorServiceProvider {
    public register() {
        //FIXME : register an actual account connector, not the abstract one
        ConnectorService.register(TConnectorService.AgentData, 'AgentData', AgentDataConnector);
        ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
        ConnectorService.register(TConnectorService.AgentData, 'Local', LocalAgentDataConnector);
        ConnectorService.register(TConnectorService.AgentData, 'SQLite', SQLiteAgentDataConnector);

        ConnectorService.register(TConnectorService.AgentData, 'NullAgentData', NullAgentData);
    }
}
