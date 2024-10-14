//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { PineconeVectorDB } from './connectors/PineconeVectorDB.class';
import { SmythManagedVectorDB } from './connectors/SmythManagedVectorDB.class';

export class VectorDBService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.VectorDB, 'Pinecone', PineconeVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'SmythManaged', SmythManagedVectorDB);
    }
}
