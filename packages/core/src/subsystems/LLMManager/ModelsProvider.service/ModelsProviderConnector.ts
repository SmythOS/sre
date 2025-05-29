import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TCustomLLMModel, TLLMCredentials, TLLMModel, TLLMModelsList, TLLMProvider } from '@sre/types/LLM.types';
import { customModels } from '../custom-models';
import { LocalCache } from '@sre/helpers/LocalCache.helper';

export interface IModelsProviderRequest {
    getModels(): Promise<any>;
    getModelInfo(model: string, hasAPIKey?: boolean): Promise<TLLMModel>;
    getModelId(model: string): Promise<string>;
    getProvider(model: string): Promise<string>;
    isStandardLLM(model: string): Promise<boolean>;
    adjustMaxCompletionTokens(model: string, maxCompletionTokens: number, hasAPIKey?: boolean): Promise<number>;
    getMaxContextTokens(model: string, hasAPIKey?: boolean): Promise<number>;
    getMaxCompletionTokens(model: string, hasAPIKey?: boolean): Promise<number>;
    validateTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasAPIKey,
    }: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        hasAPIKey?: boolean;
    }): Promise<void>;
}

export abstract class ModelsProviderConnector extends SecureConnector {
    private static localCache = new LocalCache();
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract getModels(acRequest: AccessRequest): Promise<TLLMModelsList>;

    public requester(candidate: AccessCandidate): IModelsProviderRequest {
        const cacheKey = `ModelsProviderConnector:${candidate.toString()}`;
        if (ModelsProviderConnector.localCache.has(cacheKey)) {
            //update the TTL every time the requester is called
            return ModelsProviderConnector.localCache.get(cacheKey, 60 * 60 * 1000) as IModelsProviderRequest;
        }

        let teamModels = null;
        let customModels = null;

        const loadTeamModels = async () => {
            if (!teamModels) {
                try {
                    const builtinmodels = await this.getModels(candidate.readRequest);
                    customModels = await this.getCustomModels(candidate);
                    teamModels = { ...builtinmodels, ...customModels };
                } catch (error) {
                    return null;
                }
            }
            return teamModels;
        };
        loadTeamModels();

        const instance = {
            getModels: async () => {
                return await loadTeamModels();
            },
            getModelInfo: async (model: string, hasAPIKey: boolean = false) => {
                const teamModels = await loadTeamModels();
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo;
            },

            getModelId: async (model: string) => {
                const teamModels = await loadTeamModels();
                return this.getModelId(candidate.readRequest, teamModels, model);
            },
            getProvider: async (model: string) => {
                const teamModels = await loadTeamModels();
                return this.getProvider(candidate.readRequest, teamModels, model);
            },
            isStandardLLM: async (model: string) => {
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model);
                return !modelInfo.isCustomLLM;
            },
            adjustMaxCompletionTokens: async (model: string, maxCompletionTokens: number, hasAPIKey: boolean = false) => {
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return Math.min(maxCompletionTokens, modelInfo?.completionTokens || modelInfo?.tokens);
            },
            getMaxContextTokens: async (model: string, hasAPIKey: boolean = false) => {
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo?.tokens;
            },
            getMaxCompletionTokens: async (model: string, hasAPIKey: boolean = false) => {
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo?.completionTokens || modelInfo?.tokens;
            },
            validateTokensLimit: async ({
                model,
                promptTokens,
                completionTokens,
                hasAPIKey,
            }: {
                model: string;
                promptTokens: number;
                completionTokens: number;
                hasAPIKey: boolean;
            }) => {
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                const allowedContextTokens = modelInfo?.tokens;
                const totalTokens = promptTokens + completionTokens;

                const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
                const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key and select Personal tagged models to unlock full length.`;

                if (totalTokens > allowedContextTokens) {
                    throw new Error(hasAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
                }
            },
        };
        ModelsProviderConnector.localCache.set(cacheKey, instance, 60 * 60 * 1000); // cache for 1 hour
        return instance;
    }

    protected async getModelInfo(acRequest: AccessRequest, models: TLLMModelsList, model: string, hasAPIKey: boolean = false): Promise<TLLMModel> {
        const modelId = await this.getModelId(acRequest, models, model);
        const alias = models?.[model]?.alias;
        const aliasModelInfo = models?.[alias];

        const modelInfo = models?.[model];

        const aliasKeyOptions = aliasModelInfo && hasAPIKey ? aliasModelInfo?.keyOptions : null;

        const modelKeyOptions = modelInfo?.keyOptions || aliasKeyOptions;

        return { ...aliasModelInfo, ...modelInfo, ...aliasKeyOptions, ...modelKeyOptions, modelId };
    }

    protected async getModelId(acRequest: AccessRequest, models: TLLMModelsList, model: string): Promise<string> {
        const modelId = models?.[model]?.modelId || model;
        const alias = models?.[model]?.alias;
        if (alias) {
            const aliasModelId = models?.[alias]?.modelId || alias || model;
            return aliasModelId;
        }

        return modelId;
    }

    // public static async validateTokensLimit({
    //     model,
    //     promptTokens,
    //     completionTokens,
    //     hasAPIKey = false,
    // }: {
    //     model: string;
    //     promptTokens: number;
    //     completionTokens: number;
    //     hasAPIKey?: boolean;
    // }): Promise<void> {

    //     const allowedContextTokens = this.getMaxContextTokens(model, hasAPIKey);
    //     const totalTokens = promptTokens + completionTokens;

    //     const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
    //     const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`;

    //     if (totalTokens > allowedContextTokens) {
    //         throw new Error(hasAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
    //     }
    // }

    protected async getProvider(acRequest: AccessRequest, models: TLLMModelsList, model: string): Promise<string> {
        const modelId = await this.getModelId(acRequest, models, model);

        return models?.[modelId]?.provider || models?.[model]?.provider || models?.[modelId]?.llm || models?.[model]?.llm;
    }
    protected async getCustomModels(candidate: IAccessCandidate): Promise<Record<string, any>> {
        const models = {};
        const settingsKey = 'custom-llm';

        try {
            const accountConnector = ConnectorService.getAccountConnector();
            const team = await accountConnector.requester(candidate as AccessCandidate).getTeam();

            const teamSettings = await accountConnector.team(team).getTeamSetting(settingsKey);
            const savedCustomModelsData = JSON.parse(teamSettings || '{}') as Record<string, any>;

            for (const [entryId, entry] of Object.entries(savedCustomModelsData)) {
                const foundationModel = entry.settings.foundationModel;
                const customModel = entry.settings.customModel;
                const supportsSystemPrompt = customModels[foundationModel]?.supportsSystemPrompt || entry.settings.supportsSystemPrompt;
                const customModelData = customModels[foundationModel] || {};

                let credentials = null;
                switch (entry.provider) {
                    case TLLMProvider.Bedrock:
                        credentials = TLLMCredentials.BedrockVault;
                        break;
                    case TLLMProvider.VertexAI:
                        credentials = TLLMCredentials.VertexAIVault;
                        break;
                    default:
                        credentials = TLLMCredentials.Internal;
                        break;
                }
                models[entry.name] = {
                    label: entry.name,
                    modelId: customModel || foundationModel,
                    provider: entry.provider,
                    features: entry.features?.map((feature) => {
                        switch (feature) {
                            case 'text-completion':
                                return 'text';
                            case 'tool-use':
                                return 'tools';
                            default:
                                return feature;
                        }
                    }),
                    tags: Array.isArray(entry?.tags) ? ['Enterprise', ...entry?.tags] : ['Enterprise'],
                    tokens: customModelData?.tokens ?? 100000,
                    completionTokens: customModelData?.completionTokens ?? 4096,
                    enabled: true,

                    id: entryId,
                    name: entry.name,
                    alias: foundationModel,
                    llm: entry.provider,
                    components: customModelData?.components ?? [],
                    isCustomLLM: true,
                    supportsSystemPrompt,
                    settings: entry.settings,
                    credentials,
                };
            }

            return models;
        } catch (error) {
            return {};
        }
    }
}
