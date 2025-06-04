//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { AWSLambdaCode } from './connectors/AWSLambdaCode.class';

export class CodeService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Code, 'AWSLambda', AWSLambdaCode);
    }
}
