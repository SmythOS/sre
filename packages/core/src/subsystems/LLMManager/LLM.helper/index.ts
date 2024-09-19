import axios from 'axios';

import { ModelRegistry } from './ModelRegistry.helper';
import { TokenManager } from './TokenManager.helper';
import { MessageProcessor } from './MessageProcessor.helper';
import { FileProcessor } from './FileProcessor.helper';

import { getM2MToken } from '@sre/utils/oauth.utils';

import config from '@sre/config';

export class LLMHelper {
    private modelRegistry: ModelRegistry;
    private tokenManager: TokenManager;
    private messageProcessor: MessageProcessor;
    private fileProcessor: FileProcessor;

    constructor() {
        this.modelRegistry = new ModelRegistry();
        this.tokenManager = new TokenManager(this.modelRegistry);
        this.messageProcessor = new MessageProcessor();
        this.fileProcessor = new FileProcessor();
    }

    static async load(teamId?: string): Promise<LLMHelper> {
        const llmHelper = new LLMHelper();

        if (teamId) {
            await llmHelper.initializeWithCustomModels(teamId);
        }

        return llmHelper;
    }

    private async initializeWithCustomModels(teamId: string) {
        const customModels = await this.getCustomModels(teamId);

        this.modelRegistry.addCustomModels(customModels);
    }

    private async getCustomModels(teamId: string): Promise<Record<string, any>> {
        const customModels = {};
        const settingsKey = 'custom-llm';

        try {
            // TODO [Forhad]: Need to load team settings from Account Connector
            const accessToken = await getM2MToken({
                oauthAppId: config.env.LOGTO_M2M_APP_ID,
                oauthAppSecret: config.env.LOGTO_M2M_APP_SECRET,
                resource: config.env.LOGTO_API_RESOURCE,
                scope: '',
                baseUrl: `${config.env.LOGTO_SERVER}/oidc/token`,
            });

            const url = `${config.env.SMYTH_API_BASE_URL}/_sysapi/v1/teams/${teamId}/settings/${settingsKey}`;

            const res = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const savedCustomModelsData: Record<string, any> = JSON.parse(res?.data?.setting?.settingValue || '{}');

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

    // Expose instances
    public getModelRegistry(): ModelRegistry {
        return this.modelRegistry;
    }

    public getTokenManager(): TokenManager {
        return this.tokenManager;
    }

    public getMessageProcessor(): MessageProcessor {
        return this.messageProcessor;
    }

    public getFileProcessor(): FileProcessor {
        return this.fileProcessor;
    }
}
