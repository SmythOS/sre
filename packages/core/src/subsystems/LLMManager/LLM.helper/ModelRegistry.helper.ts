import { models } from '../models';
import type { TBedrockModel, TVertexAIModel } from '@sre/types/LLM.types';

export class ModelRegistry {
    private _models: Record<string, any> = models;

    public get models(): Record<string, any> {
        return this._models;
    }

    public set models(models: Record<string, any>) {
        this._models = models;
    }

    public addCustomModels(customModels: Record<string, any>) {
        this._models = { ...this._models, ...customModels };
    }

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
        const baseModelInfo = this.models[modelId] || {};

        if (hasAPIKey) {
            const keyOptions = this.getModelKeyOptions(modelId);
            return { ...baseModelInfo, ...keyOptions };
        }

        return baseModelInfo;
    }

    public getProvider(modelName: string): string {
        const modelId = this.getModelId(modelName);
        return this.models?.[modelId]?.llm;
    }

    public modelExists(modelName: string): boolean {
        if (modelName.toLowerCase() === 'echo') return true;
        const modelId = this.getModelId(modelName);
        return !!this.models?.[modelId];
    }

    public getModelId(modelName: string): string {
        if (this.models[modelName]) {
            return this.models?.[modelName]?.alias || modelName;
        }
        for (const [id, model] of Object.entries(this.models)) {
            if (model.name === modelName) {
                return id;
            }
        }
        return modelName;
    }

    public getModelName(modelName: string): string {
        return this.models?.[modelName]?.alias || modelName;
    }

    public getModelKeyOptions(modelId: string): Record<string, any> {
        return this.models?.[modelId]?.keyOptions || {};
    }
}
