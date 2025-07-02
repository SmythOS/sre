//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { PineconeVectorDB } from './connectors/PineconeVectorDB.class';
import { MilvusVectorDB } from './connectors/MilvusVectorDB.class.js';
import { RAMVectorDB } from './connectors/RAMVecrtorDB.class';
export class VectorDBService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.VectorDB, 'Pinecone', PineconeVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'RAMVec', RAMVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'Milvus', MilvusVectorDB);
    }
}
