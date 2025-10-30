//==[ SRE: Scheduler ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LocalScheduler } from './connectors/LocalScheduler.class';

export class SchedulerService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Scheduler, 'LocalScheduler', LocalScheduler);
    }
}
