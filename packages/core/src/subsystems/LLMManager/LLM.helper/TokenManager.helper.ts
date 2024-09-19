import { ModelRegistry } from './ModelRegistry.helper';

export class TokenManager {
    constructor(private modelRegistry: ModelRegistry) {}

    public async getAllowedContextTokens(modelName: string, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = await this.modelRegistry.getModelInfo(modelName, hasAPIKey);
        return modelInfo?.tokens;
    }

    public async getAllowedCompletionTokens(modelName: string, hasAPIKey: boolean = false): Promise<number> {
        const modelInfo = await this.modelRegistry.getModelInfo(modelName, hasAPIKey);
        return modelInfo?.completionTokens || modelInfo?.tokens;
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
        let allowedTokens = await this.getAllowedCompletionTokens(modelName, hasAPIKey);
        return Math.min(givenMaxTokens, allowedTokens);
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
}
