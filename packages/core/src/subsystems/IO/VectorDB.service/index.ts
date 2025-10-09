//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { PineconeVectorDB } from './connectors/PineconeVectorDB.class';
import { MilvusVectorDB } from './connectors/MilvusVectorDB.class';
import { RAMVectorDB } from './connectors/RAMVecrtorDB.class';

export enum TVectorDBProvider {
    Pinecone = 'Pinecone',
    RAMVec = 'RAMVec',
    Milvus = 'Milvus',
    SmythManaged = 'SmythManaged', // SAAS custom connector
}

export class VectorDBService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.VectorDB, TVectorDBProvider.Pinecone, PineconeVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, TVectorDBProvider.RAMVec, RAMVectorDB);
        ConnectorService.register(TConnectorService.VectorDB, TVectorDBProvider.Milvus, MilvusVectorDB);
    }
}
