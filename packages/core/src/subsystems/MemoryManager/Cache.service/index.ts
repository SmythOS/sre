//==[ SRE: Cache ]======================
import { ConnectorServiceProvider, ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { RedisCache } from './connectors/RedisCache.class';
import { S3Cache } from './connectors/S3Cache.class';
import { LocalStorageCache } from './connectors/LocalStorageCache.class';
import { RAMCache } from './connectors/RAMCache.class';
import { MemcachedCache } from './connectors/MemcachedCache.class';
export class CacheService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Cache, 'Redis', RedisCache);
        ConnectorService.register(TConnectorService.Cache, 'S3', S3Cache);
        ConnectorService.register(TConnectorService.Cache, 'LocalStorage', LocalStorageCache);
        ConnectorService.register(TConnectorService.Cache, 'RAM', RAMCache);
        ConnectorService.register(TConnectorService.Cache, 'Memcached', MemcachedCache);
    }
}
