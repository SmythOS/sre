//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { PineconeVectorDB } from './connectors/PineconeVectorDB.class';
import { MilvusVectorDB } from './connectors/MilvusVectorDB.class';
import { RAMVectorDB } from './connectors/RAMVecrtorDB.class';
import { WeaviateVectorDB } from './connectors/WeaviateVectorDB.class';
export class VectorDBService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.VectorDB, 'Pinecone', PineconeVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'RAMVec', RAMVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'Milvus', MilvusVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, 'Weaviate', WeaviateVectorDB);
    }
}
