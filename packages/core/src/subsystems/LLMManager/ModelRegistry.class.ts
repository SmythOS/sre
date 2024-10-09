import { ConnectorService } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { models } from './models';

export class ModelRegistry {
    /**
     * Retrieves information about a specific model.
     *
     * @param {string} modelName - The name of the model to retrieve information for.
     * @param {boolean} hasAPIKey - Indicates whether the user has an API key.
     * @returns {Promise<Record<string, any>>} A promise that resolves to an object containing model information.
     *
     * @description
     * This method fetches information about a specific model. If the user has an API key,
     * it includes additional key options in the returned information.
     *
     * The process is as follows:
     * 1. Get the model ID from the model name.
     * 2. Retrieve the base model information from the models object.
     * 3. If the user has an API key, fetch additional key options and merge them with the base info.
     * 4. Return the combined model information.
     *
     * @example
     * const modelInfo = await modelRegistry.getModelInfo('gpt-3.5-turbo', true);
     */
    public async getModelInfo(modelName: string, hasAPIKey: boolean = false): Promise<Record<string, any>> {
        const modelId = this.getModelId(modelName);
        const baseModelInfo = models[modelId] || {};

        if (hasAPIKey) {
            const keyOptions = this.getModelKeyOptions(modelId);
            return { ...baseModelInfo, ...keyOptions };
        }

        return baseModelInfo;
    }

    public getProvider(modelName: string): string {
        const modelId = this.getModelId(modelName);
        return models?.[modelId]?.llm;
    }
    public getBaseURL(modelName: string): string {
        const modelId = this.getModelId(modelName);
        return models?.[modelId]?.baseURL || undefined;
    }

    public modelExists(modelName: string): boolean {
        if (modelName.toLowerCase() === 'echo') return true;
        const modelId = this.getModelId(modelName);
        return !!models?.[modelId];
    }

    public getModelId(modelName: string): string {
        return models?.[modelName]?.alias || modelName;
    }

    public getModelName(modelName: string): string {
        return models?.[modelName]?.alias || modelName;
    }

    public getModelKeyOptions(modelId: string): Record<string, any> {
        return models?.[modelId]?.keyOptions || {};
    }

    public async getAllowedContextTokens(modelName: string, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = await this.getModelInfo(modelName, hasAPIKey);
        return modelInfo?.tokens;
    }

    public async getMaxCompletionTokens(modelName: string, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = await this.getModelInfo(modelName, hasAPIKey);
        return modelInfo?.completionTokens || modelInfo?.tokens;
    }
    public async adjustMaxCompletionTokens(modelName: string, maxTokens: number, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = await this.getModelInfo(modelName, hasAPIKey);
        return Math.min(maxTokens, modelInfo?.completionTokens || modelInfo?.tokens);
    }

    public async getSafeMaxTokens({
        givenMaxTokens,
        modelName,
        hasAPIKey = false,
    }: {
        givenMaxTokens: number;
        modelName: string;
        hasAPIKey?: boolean;
    }): Promise<number> {
        let maxCompletionTokens = await this.getMaxCompletionTokens(modelName, hasAPIKey);
        return Math.min(givenMaxTokens, maxCompletionTokens);
    }

    /**
     * Validates if the total tokens (prompt input token + maximum output token) exceed the allowed context tokens for a given model.
     *
     * @param {Object} params - The function parameters.
     * @param {string} params.model - The model identifier.
     * @param {number} params.promptTokens - The number of tokens in the input prompt.
     * @param {number} params.completionTokens - The number of tokens in the output completion.
     * @param {boolean} [params.hasTeamAPIKey=false] - Indicates if the user has a team API key.
     * @throws {Error} - Throws an error if the total tokens exceed the allowed context tokens.
     */
    public async validateTokensLimit({
        modelName,
        promptTokens,
        completionTokens,
        hasAPIKey = false,
    }: {
        modelName: string;
        promptTokens: number;
        completionTokens: number;
        hasAPIKey?: boolean;
    }): Promise<void> {
        const allowedContextTokens = await this.getAllowedContextTokens(modelName, hasAPIKey);
        const totalTokens = promptTokens + completionTokens;

        const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
        const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`;

        if (totalTokens > allowedContextTokens) {
            throw new Error(hasAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
        }
    }

    //#region Custom Models Registry

    public async getCustomModelInfo(modelName: string, teamId: string): Promise<Record<string, any>> {
        const customModels = await this.getCustomModels(teamId);

        for (const model of Object.values(customModels)) {
            if (model.name === modelName) {
                return model;
            }
        }

        return null;
    }

    private async getCustomModels(teamId: string): Promise<Record<string, any>> {
        const customModels = {};
        const settingsKey = 'custom-llm';

        try {
            const accountConnector = ConnectorService.getAccountConnector();

            const teamSettings = await accountConnector.user(AccessCandidate.team(teamId)).getTeamSetting(settingsKey);
            const savedCustomModelsData = JSON.parse(teamSettings || '{}') as Record<string, any>;

            for (const [entryId, entry] of Object.entries(savedCustomModelsData)) {
                customModels[entryId] = {
                    id: entryId,
                    name: entry.name,
                    llm: entry.provider,
                    components: entry.components,
                    tags: entry.tags,
                    tokens: entry?.tokens ?? 100000,
                    completionTokens: entry?.completionTokens ?? 4096,
                    provider: entry.provider,
                    features: entry.features,
                    settings: entry.settings,
                    enabled: true,
                    isCustomLLM: true,
                };
            }

            return customModels;
        } catch (error) {
            return {};
        }
    }
    //#endregion Custom Models Registry
}
