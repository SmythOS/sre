import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { JSONFileVault } from './connectors/JSONFileVault.class';
import { SmythVault } from './connectors/SmythVault.class';
import { SecretsManager } from './connectors/SecretsManager.class';

export class VaultService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Vault, 'JSONFileVault', JSONFileVault);
        ConnectorService.register(TConnectorService.Vault, 'SmythVault', SmythVault);
        ConnectorService.register(TConnectorService.Vault, 'SecretsManager', SecretsManager);
    }
}
