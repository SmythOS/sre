// import { ConnectorService } from '@sre/Core/ConnectorsService';
// import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
// import { customModels } from './custom-models';
// import { TCustomLLMModel } from '@sre/types/LLM.types';
// import { TAccessRole } from '@sre/types/ACL.types';

// export class CustomLLMRegistry {
//     private models: Record<string, any> = {}; // TODO [Forhad]: apply proper typing

//     public static async getInstance(team: AccessCandidate) {
//         if (!team || team.role !== TAccessRole.Team) throw new Error('Please provide a valid team.');

//         const registry = new CustomLLMRegistry();

//         await registry.loadCustomModels(team);

//         return registry;
//     }

//     public getProvider(model: string): string {
//         const entryId = this.getModelEntryId(model);
//         return this.models?.[entryId]?.provider || this.models?.[entryId]?.llm;
//     }

//     public getModelInfo(model: string): TCustomLLMModel {
//         const entryId = this.getModelEntryId(model);
//         const modelInfo = this.models?.[entryId] || {};

//         return { ...modelInfo, modelId: model };
//     }

//     private async loadCustomModels(team: AccessCandidate) {
//         const savedCustomModels = await this.getCustomModels(team);

//         this.models = { ...this.models, ...savedCustomModels };
//     }

//     public getModelEntryId(model: string): string {
//         for (const [id, modelInfo] of Object.entries(this.models)) {
//             if (modelInfo.name === model) return id;
//         }

//         return model;
//     }

//     public getModelId(model: string): string {
//         const modelInfo = this.getModelInfo(model);

//         return modelInfo.settings?.customModel || modelInfo.settings?.foundationModel;
//     }

//     public getModelFeatures(model: string): string[] {
//         const modelInfo = this.getModelInfo(model);
//         return modelInfo?.features || [];
//     }

//     public getMaxContextTokens(model: string): number {
//         const modelInfo = this.getModelInfo(model);
//         return modelInfo?.tokens;
//     }

//     public async getMaxCompletionTokens(model: string) {
//         const modelInfo = this.getModelInfo(model);

//         return modelInfo?.completionTokens || modelInfo?.tokens;
//     }

//     public adjustMaxCompletionTokens(model: string, maxTokens: number): number {
//         const modelInfo = this.getModelInfo(model);
//         return Math.min(maxTokens, modelInfo?.completionTokens || modelInfo?.tokens);
//     }

//     public adjustMaxThinkingTokens(maxTokens: number, maxThinkingTokens: number): number {
//         // Limit the thinking tokens to 80% of the max tokens, (thinking tokens must be less than max tokens)
//         const validMaxThinkingTokens = Math.min(maxTokens * 0.8, maxThinkingTokens);
//         return Math.min(validMaxThinkingTokens, maxThinkingTokens);
//     }

//     private async getCustomModels(team: AccessCandidate): Promise<Record<string, any>> {
//         const models = {};
//         const settingsKey = 'custom-llm';

//         try {
//             const accountConnector = ConnectorService.getAccountConnector();

//             const teamSettings = await accountConnector.user(team).getTeamSetting(settingsKey);
//             const savedCustomModelsData = JSON.parse(teamSettings || '{}') as Record<string, any>;

//             for (const [entryId, entry] of Object.entries(savedCustomModelsData)) {
//                 const foundationModel = entry.settings.foundationModel;
//                 const customModel = entry.settings.customModel;
//                 const supportsSystemPrompt = customModels[foundationModel]?.supportsSystemPrompt || entry.settings.supportsSystemPrompt;
//                 const customModelData = customModels[foundationModel] || {};

//                 models[entryId] = {
//                     label: entry.name,
//                     modelId: customModel || foundationModel,
//                     provider: entry.provider,
//                     features: entry.features?.map((feature) => {
//                         switch (feature) {
//                             case 'text-completion':
//                                 return 'text';
//                             case 'tool-use':
//                                 return 'tools';
//                             default:
//                                 return feature;
//                         }
//                     }),
//                     tags: Array.isArray(entry?.tags) ? ['Enterprise', ...entry?.tags] : ['Enterprise'],
//                     tokens: customModelData?.tokens ?? 100000,
//                     completionTokens: customModelData?.completionTokens ?? 4096,
//                     enabled: true,

//                     id: entryId,
//                     name: entry.name,
//                     alias: foundationModel,
//                     llm: entry.provider,
//                     components: customModelData?.components ?? [],
//                     isCustomLLM: true,
//                     supportsSystemPrompt,
//                     settings: entry.settings,
//                 };
//             }

//             return models;
//         } catch (error) {
//             return {};
//         }
//     }
// }
