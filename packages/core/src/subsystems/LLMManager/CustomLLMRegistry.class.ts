import { ConnectorService } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { customModels } from './custom-models';

export class CustomLLMRegistry {
    private models: Record<string, any> = {}; // TODO [Forhad]: apply proper typing

    public static async getInstance(teamId: string) {
        if (!teamId) throw new Error('Please provide a valid team ID.');

        const registry = new CustomLLMRegistry();

        await registry.loadCustomModels(teamId);

        return registry;
    }

    public getProvider(model: string): string {
        const modelId = this.getModelId(model);
        return this.models?.[modelId]?.llm;
    }

    public getModelInfo(model: string): Record<string, any> {
        const modelId = this.getModelId(model);
        const modelInfo = this.models?.[modelId] || {};

        return modelInfo;
    }

    public getMaxContextTokens(model: string): number {
        const modelInfo = this.getModelInfo(model);
        return modelInfo?.tokens;
    }

    public async getMaxCompletionTokens(model: string) {
        const modelInfo = this.getModelInfo(model);

        return modelInfo?.completionTokens || modelInfo?.tokens;
    }

    public adjustMaxCompletionTokens(model: string, maxTokens: number): number {
        const modelInfo = this.getModelInfo(model);
        return Math.min(maxTokens, modelInfo?.completionTokens || modelInfo?.tokens);
    }

    private async loadCustomModels(teamId?: string) {
        const savedCustomModels = await this.getCustomModels(teamId);

        this.models = { ...this.models, ...savedCustomModels };
    }

    public getModelId(model: string): string {
        for (const [id, modelInfo] of Object.entries(this.models)) {
            if (modelInfo.name === model) return id;
        }

        return model;
    }

    private async getCustomModels(teamId: string): Promise<Record<string, any>> {
        const models = {};
        const settingsKey = 'custom-llm';

        try {
            const accountConnector = ConnectorService.getAccountConnector();

            const teamSettings = await accountConnector.user(AccessCandidate.team(teamId)).getTeamSetting(settingsKey);
            const savedCustomModelsData = JSON.parse(teamSettings || '{}') as Record<string, any>;

            for (const [entryId, entry] of Object.entries(savedCustomModelsData)) {
                const foundationModel = entry.settings.foundationModel;
                const tokens = customModels[foundationModel]?.tokens || entry?.tokens;
                const completionTokens = customModels[foundationModel]?.completionTokens || entry?.completionTokens;
                const supportsSystemPrompt = customModels[foundationModel]?.supportsSystemPrompt || entry.settings.supportsSystemPrompt;

                models[entryId] = {
                    id: entryId,
                    name: entry.name,
                    alias: foundationModel,
                    llm: entry.provider,
                    tokens,
                    completionTokens,
                    enabled: true,
                    components: entry.components,
                    tags: entry.tags,

                    supportsSystemPrompt,
                    provider: entry.provider,
                    features: entry.features,
                    settings: entry.settings,
                };
            }

            return models;
        } catch (error) {
            return {};
        }
    }
}
