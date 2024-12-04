import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { Logger } from '@sre/helpers/Log.helper';
import { SmythLog } from './connectors/SmythLog.class';
import { ConsoleLog } from './connectors/ConsoleLog.class';

const console = Logger('LogService');

export class LogService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Log, 'SmythLog', SmythLog);
        ConnectorService.register(TConnectorService.Log, 'ConsoleLog', ConsoleLog);
    }
}
