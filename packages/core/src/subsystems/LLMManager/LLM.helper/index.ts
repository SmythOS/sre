import { ModelRegistry } from './ModelRegistry.helper';
import { TokenManager } from './TokenManager.helper';
import { MessageProcessor } from './MessageProcessor.helper';
import { FileProcessor } from './FileProcessor.helper';

import { ConnectorService } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

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

    // Expose instances
    public ModelRegistry(): ModelRegistry {
        return this.modelRegistry;
    }

    public TokenManager(): TokenManager {
        return this.tokenManager;
    }

    public MessageProcessor(): MessageProcessor {
        return this.messageProcessor;
    }

    public FileProcessor(): FileProcessor {
        return this.fileProcessor;
    }
}
