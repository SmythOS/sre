import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { CLIConnector } from './CLIConnector';

export class CLIService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.CLI, 'CLI', CLIConnector);
    }
}
