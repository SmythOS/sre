//==[ SRE: Cache ]======================
export * from './CacheConnector';
import { ConnectorServiceProvider, ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { RedisCache } from './connectors/RedisCache.class';

export class CacheService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Cache, 'Redis', RedisCache);
    }
}
