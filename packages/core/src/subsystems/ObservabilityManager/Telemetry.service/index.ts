import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';

import { OTel } from './connectors/OTel/OTel.class';

//const console = Logger('LogService');

export class TelemetryService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Telemetry, 'OTel', OTel);
    }
}
