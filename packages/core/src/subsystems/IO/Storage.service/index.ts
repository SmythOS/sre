//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { S3Storage } from './connectors/S3Storage.class';
import { LocalStorage } from './connectors/LocalStorage.class';
import { GCSStorage } from './connectors/GCSStorage.class';

export class StorageService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Storage, 'S3', S3Storage);
        ConnectorService.register(TConnectorService.Storage, 'LocalStorage', LocalStorage);
        ConnectorService.register(TConnectorService.Storage, 'GCS', GCSStorage);
    }
}
