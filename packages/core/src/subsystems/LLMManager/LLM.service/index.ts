//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/OpenAI.class';
import { GoogleAIConnector } from './connectors/GoogleAI.class';
import { AnthropicConnector } from './connectors/Anthropic.class';
import { GroqConnector } from './connectors/Groq.class';
import { BedrockConnector } from './connectors/Bedrock.class';
import { VertexAIConnector } from './connectors/VertexAI.class';
import { PerplexityConnector } from './connectors/Perplexity.class';
import { OpenRouterConnector } from './connectors/OpenRouter.class';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'DeepSeek', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'GoogleAI', GoogleAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Anthropic', AnthropicConnector);
        ConnectorService.register(TConnectorService.LLM, 'Groq', GroqConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenRouter', OpenRouterConnector);
        ConnectorService.register(TConnectorService.LLM, 'TogetherAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Bedrock', BedrockConnector);
        ConnectorService.register(TConnectorService.LLM, 'VertexAI', VertexAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'xAI', xAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Perplexity', PerplexityConnector);
    }

    public init() {
        //auto initialize built-in models
        ConnectorService.init(TConnectorService.LLM, 'Echo');
        ConnectorService.init(TConnectorService.LLM, 'OpenAI');
        ConnectorService.init(TConnectorService.LLM, 'DeepSeek');
        ConnectorService.init(TConnectorService.LLM, 'GoogleAI');
        ConnectorService.init(TConnectorService.LLM, 'Anthropic');
        ConnectorService.init(TConnectorService.LLM, 'Groq');
        ConnectorService.init(TConnectorService.LLM, 'OpenRouter');
        ConnectorService.init(TConnectorService.LLM, 'TogetherAI');
        ConnectorService.init(TConnectorService.LLM, 'Bedrock');
        ConnectorService.init(TConnectorService.LLM, 'VertexAI');
        ConnectorService.init(TConnectorService.LLM, 'xAI');
        ConnectorService.init(TConnectorService.LLM, 'Perplexity');
    }
}
