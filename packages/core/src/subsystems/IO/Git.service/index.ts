import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { GitConnector } from './GitConnector';

export class GitService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Git, 'Git', GitConnector);
    }
}
