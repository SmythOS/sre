//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/OpenAI.class';
import { GoogleAIConnector } from './connectors/GoogleAI.class';
import { AnthropicAIConnector } from './connectors/AnthropicAI.class';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'GoogleAI', GoogleAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'AnthropicAI', AnthropicAIConnector);
    }

    public init() {
        //auto initialize builting models
        ConnectorService.init(TConnectorService.LLM, 'Echo');
        ConnectorService.init(TConnectorService.LLM, 'OpenAI');
        ConnectorService.init(TConnectorService.LLM, 'GoogleAI');
        ConnectorService.init(TConnectorService.LLM, 'AnthropicAI');
    }
}
