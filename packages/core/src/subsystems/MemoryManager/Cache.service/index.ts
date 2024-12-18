//==[ SRE: Cache ]======================
export * from './CacheConnector';
import { ConnectorServiceProvider, ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { RedisCache } from './connectors/RedisCache.class';
import { S3Cache } from './connectors/S3Cache.class';

export class CacheService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Cache, 'Redis', RedisCache);
        ConnectorService.register(TConnectorService.Cache, 'S3', S3Cache);
    }
}
