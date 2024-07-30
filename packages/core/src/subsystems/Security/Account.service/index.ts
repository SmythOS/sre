//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { AccountConnector } from './AccountConnector';

export class AccountService extends ConnectorServiceProvider {
    public register() {
        //FIXME : register an actual account connector, not the abstract one
        ConnectorService.register(TConnectorService.Account, 'Account', AccountConnector);
    }

    public init() {
        //auto initialize builtin account connector
        ConnectorService.init(TConnectorService.Account, 'Account');
    }
}
