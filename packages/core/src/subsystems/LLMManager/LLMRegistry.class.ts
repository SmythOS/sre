import { models } from './models';

export class LLMRegistry {
    private static instance: LLMRegistry = null;

    private constructor(private model: string) {
        this.model = model;
    }

    public static getInstance(model: string) {
        if (!this.instance) {
            this.instance = new LLMRegistry(model);
        }

        return this.instance;
    }

    public static isStandardLLM(model: string): boolean {
        return this.modelExists(model);
    }

    public static getModelId(model: string): string {
        return models?.[model]?.alias || model;
    }

    public static getBaseURL(model: string): string {
        const modelId = this.getModelId(model);
        return models?.[modelId]?.baseURL || undefined;
    }

    public static getModelKeyOptions(model: string): Record<string, any> {
        const modelId = this.getModelId(model);
        return models?.[modelId]?.keyOptions || {};
    }

    public static getProvider(model: string): string {
        const modelId = this.getModelId(model);
        return models?.[modelId]?.llm;
    }

    public static getModelInfo(model: string, hasAPIKey: boolean = false): Record<string, any> {
        const modelId = this.getModelId(model);
        const modelInfo = models?.[modelId] || {};

        if (hasAPIKey) {
            const keyOptions = LLMRegistry.getModelKeyOptions(modelId);
            return { ...modelInfo, ...keyOptions };
        }

        return modelInfo;
    }

    public static modelExists(model: string): boolean {
        if (model.toLowerCase() === 'echo') return true;
        const modelId = this.getModelId(model);
        return !!models?.[modelId];
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

    public static async adjustMaxCompletionTokens(model: string, maxTokens: number, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = this.getModelInfo(model, hasAPIKey);
        return Math.min(maxTokens, modelInfo?.completionTokens || modelInfo?.tokens);
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
