//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/openai/OpenAIConnector.class';
import { GoogleAIConnector } from './connectors/GoogleAI.class';
import { AnthropicConnector } from './connectors/Anthropic.class';
import { GroqConnector } from './connectors/Groq.class';
import { BedrockConnector } from './connectors/Bedrock.class';
import { VertexAIConnector } from './connectors/VertexAI.class';
import { PerplexityConnector } from './connectors/Perplexity.class';
import { xAIConnector } from './connectors/xAI.class';
import { OllamaConnector } from './connectors/Ollama.class';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'DeepSeek', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'GoogleAI', GoogleAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Anthropic', AnthropicConnector);
        ConnectorService.register(TConnectorService.LLM, 'Groq', GroqConnector);
        ConnectorService.register(TConnectorService.LLM, 'TogetherAI', OpenAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Bedrock', BedrockConnector);
        ConnectorService.register(TConnectorService.LLM, 'VertexAI', VertexAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'xAI', xAIConnector);
        ConnectorService.register(TConnectorService.LLM, 'Perplexity', PerplexityConnector);
        ConnectorService.register(TConnectorService.LLM, 'Ollama', OllamaConnector);
    }

    public init() {
        //auto initialize built-in models
        ConnectorService.init(TConnectorService.LLM, 'Echo');
        ConnectorService.init(TConnectorService.LLM, 'OpenAI');
        ConnectorService.init(TConnectorService.LLM, 'DeepSeek');
        ConnectorService.init(TConnectorService.LLM, 'GoogleAI');
        ConnectorService.init(TConnectorService.LLM, 'Anthropic');
        ConnectorService.init(TConnectorService.LLM, 'Groq');
        ConnectorService.init(TConnectorService.LLM, 'TogetherAI');
        ConnectorService.init(TConnectorService.LLM, 'Bedrock');
        ConnectorService.init(TConnectorService.LLM, 'VertexAI');
        ConnectorService.init(TConnectorService.LLM, 'xAI');
        ConnectorService.init(TConnectorService.LLM, 'Perplexity');
        ConnectorService.init(TConnectorService.LLM, 'Ollama');
    }
}
