//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { DummyAccount } from './connectors/DummyAccount.class';
import { MySQLAccount } from './connectors/MySQLAccount.class';
import { JSONFileAccount } from './connectors/JSONFileAccount.class';
export class AccountService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Account, 'MySQLAccount', MySQLAccount);
        ConnectorService.register(TConnectorService.Account, 'DummyAccount', DummyAccount);
        ConnectorService.register(TConnectorService.Account, 'JSONFileAccount', JSONFileAccount);
    }
}
