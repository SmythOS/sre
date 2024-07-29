//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';

export class NKVService extends ConnectorServiceProvider {
    public register() {
        //ConnectorService.register(TConnectorService.Storage, 'S3', S3Storage);
    }
}
