import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { SmythManagedVault } from './connectors/SmythManagedVault';

export class ManagedVaultService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.ManagedVault, 'SmythManagedVault', SmythManagedVault);
    }
}
