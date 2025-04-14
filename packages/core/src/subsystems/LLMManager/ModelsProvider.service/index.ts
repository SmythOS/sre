//==[ SRE: ModelsProvider ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { SmythModelsProvider } from './connectors/SmythModelsProvider.class';

export class ModelsProviderService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.ModelsProvider, 'SmythModelsProvider', SmythModelsProvider);
    }
}
