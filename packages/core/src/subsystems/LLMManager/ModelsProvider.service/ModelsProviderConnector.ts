import { ENTERPRISE_MODELS_SETTING_KEY, USER_CUSTOM_MODELS_SETTING_KEY } from '@sre/constants';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { LocalCache } from '@sre/helpers/LocalCache.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TCustomLLMModel, TLLMCredentials, TLLMModel, TLLMModelsList, TLLMProvider } from '@sre/types/LLM.types';
import { customModels } from '../custom-models';

export interface IModelsProviderRequest {
    getModels(): Promise<any>;
    getCustomModels(): Promise<any>;
    getMaxContextTokens(model: string, hasAPIKey?: boolean): Promise<number>;
    addModels(models: TLLMModelsList): Promise<void>;
    getModelInfo(model: string | TLLMModel | TCustomLLMModel, hasAPIKey?: boolean): Promise<TLLMModel>;
    getModelId(model: string | TLLMModel | TCustomLLMModel): Promise<string>;
    getProvider(model: string | TLLMModel | TCustomLLMModel): Promise<string>;
    getFallbackLLM(model: string | TLLMModel | TCustomLLMModel): Promise<string | undefined>;
    getBaseURL(model: string | TLLMModel | TCustomLLMModel): Promise<string | undefined>;
    isUserCustomLLM(model: string | TLLMModel | TCustomLLMModel): Promise<boolean>;
    isStandardLLM(model: string | TLLMModel | TCustomLLMModel): Promise<boolean>;
    adjustMaxCompletionTokens(model: string | TLLMModel | TCustomLLMModel, maxCompletionTokens: number, hasAPIKey?: boolean): Promise<number>;
    getMaxContextTokens(model: string | TLLMModel | TCustomLLMModel, hasAPIKey?: boolean): Promise<number>;
    getMaxCompletionTokens(model: string | TLLMModel | TCustomLLMModel, hasAPIKey?: boolean): Promise<number>;
    validateTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasAPIKey,
    }: {
        model: TLLMModel | TCustomLLMModel;
        promptTokens: number;
        completionTokens: number;
        hasAPIKey?: boolean;
    }): Promise<void>;
}

export abstract class ModelsProviderConnector extends SecureConnector {
    protected static localCache = new LocalCache();
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract getModels(acRequest: AccessRequest): Promise<TLLMModelsList>;
    public abstract addModels(acRequest: AccessRequest, models: TLLMModelsList): Promise<void>;

    public requester(candidate: AccessCandidate): IModelsProviderRequest {
        const cacheKey = `ModelsProviderConnector:${candidate.toString()}`;
        if (ModelsProviderConnector.localCache.has(cacheKey)) {
            //update the TTL every time the requester is called
            return ModelsProviderConnector.localCache.get(cacheKey, 10 * 60 * 1000) as IModelsProviderRequest;
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
            //Workaround : non-blocking auto-refresh of team models
            //this will force team models to refresh for the next request
            //TODO: we need a more elegant cache invalidation mechanism, and only refresh the team models if the custom models have changed
            setImmediate(async () => {
                const _customModels = await this.getCustomModels(candidate);
                teamModels = { ...teamModels, ..._customModels };
            });

            //immediatelly return the team models
            return teamModels;
        };
        loadTeamModels();

        const instance: IModelsProviderRequest = {
            getModels: async () => {
                return await loadTeamModels();
            },
            getCustomModels: async () => {
                return await this.getCustomModels(candidate);
            },
            addModels: async (models: TLLMModelsList) => {
                return await this.addModels(candidate.readRequest, models);
            },
            getModelInfo: async (model: string | TLLMModel | TCustomLLMModel, hasAPIKey: boolean = false) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo;
            },

            getModelId: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                return this.getModelId(candidate.readRequest, teamModels, model);
            },
            getProvider: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                return this.getProvider(candidate.readRequest, teamModels, model);
            },
            getFallbackLLM: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                return this.getFallbackLLM(candidate.readRequest, teamModels, model);
            },
            getBaseURL: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                return this.getBaseURL(candidate.readRequest, teamModels, model);
            },
            isUserCustomLLM: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                return this.isUserCustomLLM(candidate.readRequest, teamModels, model);
            },
            isStandardLLM: async (model: string | TLLMModel | TCustomLLMModel) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model);
                return !modelInfo.isCustomLLM;
            },
            adjustMaxCompletionTokens: async (
                model: string | TLLMModel | TCustomLLMModel,
                maxCompletionTokens: number,
                hasAPIKey: boolean = false
            ) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return Math.min(maxCompletionTokens || 512, modelInfo?.completionTokens || modelInfo?.tokens || maxCompletionTokens || 512);
            },
            getMaxContextTokens: async (model: string | TLLMModel | TCustomLLMModel, hasAPIKey: boolean = false) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo?.tokens || 1024;
            },
            getMaxCompletionTokens: async (model: string | TLLMModel | TCustomLLMModel, hasAPIKey: boolean = false) => {
                const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                const modelInfo = await this.getModelInfo(candidate.readRequest, teamModels, model, hasAPIKey);
                return modelInfo?.completionTokens || modelInfo?.tokens || 512;
            },
            validateTokensLimit: async ({
                model,
                promptTokens,
                completionTokens,
                hasAPIKey,
            }: {
                model: TLLMModel | TCustomLLMModel;
                promptTokens: number;
                completionTokens: number;
                hasAPIKey: boolean;
            }) => {
                //const teamModels = typeof model === 'string' ? await loadTeamModels() : {};
                if (Array.isArray(model?.tags) && model?.tags?.includes('sdk')) {
                    return; //skip check for SDK
                }
                const modelInfo = await this.getModelInfo(candidate.readRequest, {}, model, hasAPIKey);
                const allowedContextTokens = modelInfo?.tokens;
                const totalTokens = promptTokens + completionTokens;

                const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
                const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key and select Personal tagged models to unlock full length.`;

                if (totalTokens > allowedContextTokens) {
                    throw new Error(hasAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
                }
            },
        };
        ModelsProviderConnector.localCache.set(cacheKey, instance, 10 * 60 * 1000); // cache for 10 minutes
        return instance;
    }

    protected async getModelInfo(
        acRequest: AccessRequest,
        models: TLLMModelsList,
        model: string | TLLMModel | TCustomLLMModel,
        hasAPIKey: boolean = false
    ): Promise<TLLMModel> {
        //model can be passed directly, in which case we do not need to look it up in the models list

        let modelId, alias, aliasModelInfo, modelInfo;

        if (typeof model === 'object' && model.modelId) {
            //return model;
            modelId = model.modelId;
            alias = model.alias;
            aliasModelInfo = models?.[alias];
            modelInfo = model;
        } else {
            //model can be passed as a string, in which case we need to look it up in the models list

            modelId = await this.getModelId(acRequest, models, model);
            alias = models?.[model as string]?.alias;
            aliasModelInfo = models?.[alias];
            modelInfo = models?.[model as string];
        }

        const aliasKeyOptions = aliasModelInfo && hasAPIKey ? aliasModelInfo?.keyOptions : null;

        const modelKeyOptions = modelInfo?.keyOptions || aliasKeyOptions;

        return { ...aliasModelInfo, ...modelInfo, ...aliasKeyOptions, ...modelKeyOptions, modelId };
    }

    protected async getModelId(acRequest: AccessRequest, models: TLLMModelsList, model: string | TLLMModel | TCustomLLMModel): Promise<string> {
        //model can be passed directly, in which case we do not need to look it up in the models list
        if (typeof model === 'object' && model.modelId) {
            return model.modelId;
        }

        //model can be passed as a string, in which case we need to look it up in the models list
        const modelId = models?.[model as string]?.modelId || (model as string);
        const alias = models?.[model as string]?.alias;
        if (alias) {
            const aliasModelId = models?.[alias]?.modelId || alias || (model as string);
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

    protected async getProvider(acRequest: AccessRequest, models: TLLMModelsList, model: string | TLLMModel | TCustomLLMModel): Promise<string> {
        //model can be passed directly, in which case we do not need to look it up in the models list
        if (typeof model === 'object' && model.provider) {
            return model.provider;
        }

        //model can be passed as a string, in which case we need to look it up in the models list

        const modelId = await this.getModelId(acRequest, models, model);

        return models?.[modelId]?.provider || models?.[model as string]?.provider || models?.[modelId]?.llm || models?.[model as string]?.llm;
    }

    protected async getFallbackLLM(
        acRequest: AccessRequest,
        models: TLLMModelsList,
        model: string | TLLMModel | TCustomLLMModel
    ): Promise<string | undefined> {
        //model can be passed directly, in which case we do not need to look it up in the models list
        if (typeof model === 'object' && 'fallbackLLM' in model) {
            return model.fallbackLLM;
        }

        //model can be passed as a string, in which case we need to look it up in the models list
        const modelId = await this.getModelId(acRequest, models, model);

        return models?.[modelId]?.fallbackLLM || models?.[model as string]?.fallbackLLM;
    }

    protected async getBaseURL(
        acRequest: AccessRequest,
        models: TLLMModelsList,
        model: string | TLLMModel | TCustomLLMModel
    ): Promise<string | undefined> {
        //model can be passed directly, in which case we do not need to look it up in the models list
        if (typeof model === 'object' && 'baseURL' in model) {
            return model.baseURL;
        }

        //model can be passed as a string, in which case we need to look it up in the models list
        const modelId = await this.getModelId(acRequest, models, model);

        return models?.[modelId]?.baseURL || models?.[model as string]?.baseURL;
    }

    protected async isUserCustomLLM(acRequest: AccessRequest, models: TLLMModelsList, model: string | TLLMModel | TCustomLLMModel): Promise<boolean> {
        //model can be passed directly, in which case we do not need to look it up in the models list
        if (typeof model === 'object' && 'isUserCustomLLM' in model) {
            return !!model.isUserCustomLLM;
        }

        //model can be passed as a string, in which case we need to look it up in the models list
        const modelId = await this.getModelId(acRequest, models, model);

        return !!(models?.[modelId]?.isUserCustomLLM || models?.[model as string]?.isUserCustomLLM);
    }
    protected async getCustomModels(candidate: IAccessCandidate): Promise<Record<string, any>> {
        const enterpriseModels = await this.getEnterpriseModels(candidate);
        const userCustomModels = await this.getUserCustomModels(candidate);

        return { ...enterpriseModels, ...userCustomModels };
    }

    private async getEnterpriseModels(candidate: IAccessCandidate) {
        try {
            const models = {};
            const accountConnector = ConnectorService.getAccountConnector();
            const team = await accountConnector.requester(candidate as AccessCandidate).getTeam();

            const modelsSetting = await accountConnector.team(team).getTeamSetting(ENTERPRISE_MODELS_SETTING_KEY);
            const modelEntries = JSON.parse(modelsSetting || '{}') as Record<string, any>;

            for (const [entryId, entry] of Object.entries(modelEntries)) {
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
        } catch {
            return {};
        }
    }

    private async getUserCustomModels(candidate: IAccessCandidate) {
        try {
            const models = {};
            const accountConnector = ConnectorService.getAccountConnector();
            const team = await accountConnector.requester(candidate as AccessCandidate).getTeam();

            const modelsSetting = await accountConnector.team(team).getTeamSetting(USER_CUSTOM_MODELS_SETTING_KEY);
            const modelEntries = JSON.parse(modelsSetting || '{}') as Record<string, any>;

            for (const [entryId, entry] of Object.entries(modelEntries)) {
                models[entry.name] = {
                    label: entry.name,
                    modelId: entry?.modelId,
                    provider: entry.provider,
                    features: entry?.features || [],
                    tags: Array.isArray(entry?.tags) ? ['Custom', ...entry?.tags] : ['Custom'],
                    tokens: entry?.contextWindow ?? 8192,
                    completionTokens: entry?.maxOutputTokens ?? 8192,
                    enabled: true,

                    id: entryId,
                    name: entry.name,
                    baseURL: entry.baseURL,
                    fallbackLLM: entry.fallbackLLM,
                    isUserCustomLLM: true,

                    // TODO: Credentials will usually look like { apiKey: 'api-key-goes-here' }.
                    //       However, for fallback models we also need to handle ['vault', 'internal']
                    //       using the same credentials format, since fallback models can be either
                    //       personal or built-in.
                    credentials: entry?.credentials || ['vault', 'internal'],
                };
            }

            return models;
        } catch {
            return {};
        }
    }
}
