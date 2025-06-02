import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { ExpressRouter } from './connectors/ExpressRouter.class';
import { NullRouter } from './connectors/NullRouter.class';

export class RouterService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Router, 'ExpressRouter', ExpressRouter);
        ConnectorService.register(TConnectorService.Router, 'NullRouter', NullRouter);
    }
}
