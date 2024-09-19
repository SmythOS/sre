import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { ExpressRouter } from './connectors/ExpressRouter.class';

export class RouterService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Router, 'ExpressRouter', ExpressRouter);
    }
}
