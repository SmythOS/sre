//==[ SRE: Component ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LocalComponentConnector } from './connectors/LocalComponentConnector.class';

export class ComponentService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Component, 'LocalComponent', LocalComponentConnector);
    }
}
