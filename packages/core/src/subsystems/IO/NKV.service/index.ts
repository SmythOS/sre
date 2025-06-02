//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { NKVRedis } from './connectors/NKVRedis.class';
import { NKVRAM } from './connectors/NKVRAM.class';
export class NKVService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.NKV, 'Redis', NKVRedis);
        ConnectorService.register(TConnectorService.NKV, 'RAM', NKVRAM);
    }
}
