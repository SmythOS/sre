//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { SmythAccount } from './connectors/SmythAccount.class';

export class AccountService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Account, 'SmythAccount', SmythAccount);
    }
}
