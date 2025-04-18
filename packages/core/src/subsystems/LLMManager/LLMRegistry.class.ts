//import { models } from './models';
import { DEFAULT_SMYTHOS_LLM_PROVIDERS_SETTINGS } from '@sre/constants';
import { TLLMModelsList } from '@sre/types/LLM.types';
import SystemEvents from '@sre/Core/SystemEvents';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ModelsProviderService } from '@sre/LLMManager/ModelsProvider.service';
import { ModelsProviderConnector } from './ModelsProvider.service/ModelsProviderConnector';
//let models: TLLMModelsList = {};

SystemEvents.on('SRE:Initialized', async () => {
    const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProvider();
    LLMRegistry.models = await modelsProvider.user(AccessCandidate.user('smyth')).getModels();
});
export class LLMRegistry {
    public static models: any = {};
    private constructor() {}

    public static isStandardLLM(model: string): boolean {
        return this.modelExists(model);
    }

    public static isSmythOSModel(model: string): boolean {
        return model?.startsWith('smythos/');
    }

    public static getModelEntryId(model: string): string {
        return model;
    }

    public static getModelId(model: string): string {
        const modelId = LLMRegistry.models?.[model]?.modelId || model;
        const alias = LLMRegistry.models?.[modelId]?.alias;
        const aliasModelId = LLMRegistry.models?.[alias]?.modelId || alias;

        return aliasModelId || modelId;
    }

    public static getModelFeatures(model: string): string[] {
        return LLMRegistry.models?.[model]?.features || [];
    }

    public static getBaseURL(model: string): string {
        const modelId = this.getModelId(model);
        const modelEntryId = this.getModelEntryId(model);
        return LLMRegistry.models?.[modelId]?.baseURL || LLMRegistry.models?.[modelEntryId]?.baseURL || undefined;
    }

    public static getProvider(model: string): string {
        const modelId = this.getModelId(model);
        const modelEntryId = this.getModelEntryId(model);
        return (
            LLMRegistry.models?.[modelId]?.provider ||
            LLMRegistry.models?.[modelEntryId]?.provider ||
            LLMRegistry.models?.[modelId]?.llm ||
            LLMRegistry.models?.[modelEntryId]?.llm
        );
    }

    public static getModelInfo(model: string, hasAPIKey: boolean = false): Record<string, any> {
        const modelId = this.getModelId(model);
        const modelEntryId = this.getModelEntryId(model);
        const modelInfo = LLMRegistry.models?.[modelId] || LLMRegistry.models?.[modelEntryId] || {};

        if (hasAPIKey) {
            const keyOptions = LLMRegistry.models?.[modelId]?.keyOptions || LLMRegistry.models?.[modelEntryId]?.keyOptions || {};
            return { ...modelInfo, ...keyOptions, modelId };
        }

        return { ...modelInfo, modelId };
    }

    public static modelExists(model: string): boolean {
        if (model?.toLowerCase() === 'echo') return true;
        const modelId = this.getModelId(model);
        const modelEntryId = this.getModelEntryId(model);
        return !!LLMRegistry.models?.[modelId] || modelId === LLMRegistry.models?.[modelEntryId]?.modelId;
    }

    //#region tokens related methods
    public static getMaxContextTokens(model: string, hasAPIKey: boolean = false): number {
        const modelInfo = this.getModelInfo(model, hasAPIKey);
        return modelInfo?.tokens;
    }

    public static getMaxCompletionTokens(model: string, hasAPIKey: boolean = false): number {
        const modelInfo = this.getModelInfo(model, hasAPIKey);
        return modelInfo?.completionTokens || modelInfo?.tokens;
    }

    public static adjustMaxCompletionTokens(model: string, maxTokens: number, hasAPIKey: boolean = false): number {
        const modelInfo = this.getModelInfo(model, hasAPIKey);
        return Math.min(maxTokens, modelInfo?.completionTokens || modelInfo?.tokens);
    }

    public static adjustMaxThinkingTokens(maxTokens, maxThinkingTokens): number {
        // Limit the thinking tokens to 80% of the max tokens, (thinking tokens must be less than max tokens)
        const validMaxThinkingTokens = Math.min(maxTokens * 0.8, maxThinkingTokens);
        return Math.min(validMaxThinkingTokens, maxThinkingTokens);
    }

    public static async validateTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasAPIKey = false,
    }: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        hasAPIKey?: boolean;
    }): Promise<void> {
        const allowedContextTokens = this.getMaxContextTokens(model, hasAPIKey);
        const totalTokens = promptTokens + completionTokens;

        const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
        const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`;

        if (totalTokens > allowedContextTokens) {
            throw new Error(hasAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
        }
    }
    //#endregion tokens related methods
}
