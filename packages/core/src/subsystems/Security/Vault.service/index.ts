import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { JSONFileVault } from './connectors/JSONFileVault.class';

export class VaultService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Vault, 'JSONFileVault', JSONFileVault);
    }
}
