import { ILLMConnectorRequest, LLMChatResponse, LLMConnector } from '@sre/LLMManager/LLM.service/LLMConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMConnectorParams } from '@sre/types/LLM.types';
import { EventEmitter } from 'events';
import { DEFAULT_TEAM_ID } from '@sre/types/ACL.types';
class LLMCommand {
    constructor(
        private prompt: string,
        private llm: LLM,
    ) {}

    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    async run(): Promise<string> {
        const params = { ...this.llm._modelParams, messages: [{ role: 'user', content: this.prompt }] };
        const result = await this.llm._llmRequester.chatRequest(params);

        if (result.finishReason !== 'stop') {
            this.llm.emit('error', new Error('The model stopped before completing the response, this is usually due to output token limit reached.'));
        }
        return result;
    }

    async stream(): Promise<EventEmitter> {
        const params = { ...this.llm._modelParams, messages: [{ role: 'user', content: this.prompt }] };
        return await this.llm._llmRequester.streamRequest(params);
    }

    temperature(temp: number): LLMCommand {
        this.llm._modelParams.temperature = temp;
        return this;
    }

    // Future extensibility:
    // async batch(): Promise<string[]>
    // temperature(temp: number): PromptBuilder : override the modelParams
    // maxTokens(maxTokens: number): PromptBuilder : override the modelParams
    // ...
    // params(...): PromptBuilder : override the modelParams
}
export class LLM extends EventEmitter {
    private _candidate: AccessCandidate;
    public _llmRequester: ILLMConnectorRequest;
    public _modelParams: TLLMConnectorParams;
    constructor(providerId: string, modelParams: TLLMConnectorParams, candidate?: AccessCandidate) {
        super();
        const llmConnector = ConnectorService.getLLMConnector(providerId);
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
        this._llmRequester = llmConnector.user(this._candidate);
        this._modelParams = modelParams;
    }

    public prompt(prompt: string): LLMCommand {
        return new LLMCommand(prompt, this);
    }
}
