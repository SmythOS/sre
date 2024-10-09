//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/OpenAI.class';
import { GoogleAIConnector } from './connectors/GoogleAI.class';
import { AnthropicAIConnector } from './connectors/AnthropicAI.class';
import { GroqConnector } from './connectors/Groq.class';
import { TogetherAIConnector } from './connectors/TogetherAI.class';
import { BedrockConnector } from './connectors/Bedrock.class';
import { VertexAIConnector } from './connectors/VertexAI.class';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'DeepSeek', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'GoogleAI', GoogleAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'AnthropicAI', AnthropicAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Groq', GroqConnector);
        ConnectorService.register(TConnectorService.LLM, 'TogetherAI', TogetherAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Bedrock', BedrockConnector);
        ConnectorService.register(TConnectorService.LLM, 'VertexAI', VertexAIConnector);
    }

    public init() {
        //auto initialize builting models
        ConnectorService.init(TConnectorService.LLM, 'Echo');
        ConnectorService.init(TConnectorService.LLM, 'OpenAI');
        ConnectorService.init(TConnectorService.LLM, 'DeepSeek');
        ConnectorService.init(TConnectorService.LLM, 'GoogleAI');
        ConnectorService.init(TConnectorService.LLM, 'AnthropicAI');
        ConnectorService.init(TConnectorService.LLM, 'Groq');
        ConnectorService.init(TConnectorService.LLM, 'TogetherAI');
        ConnectorService.init(TConnectorService.LLM, 'Bedrock');
        ConnectorService.init(TConnectorService.LLM, 'VertexAI');
    }
}
