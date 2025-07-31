import { SearchToolCostConfig } from '../types';

export const MODELS_WITHOUT_TEMPERATURE_SUPPORT = ['o3-pro', 'o4-mini'];
export const MODELS_WITHOUT_PRESENCE_PENALTY_SUPPORT = ['o4-mini'];
export const MODELS_WITHOUT_JSON_RESPONSE_SUPPORT = ['o1-preview'];
export const MODELS_WITHOUT_SYSTEM_MESSAGE_SUPPORT = ['o1-mini', 'o1-preview'];

/**
 * Search tool cost configuration
 * Costs are in dollars per 1000 requests
 */
export const SEARCH_TOOL_COSTS: SearchToolCostConfig = {
    normalModels: {
        'gpt-4.1': {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        },
        'gpt-4o': {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        },
    },
    miniModels: {
        'gpt-4.1-mini': {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        },
        'gpt-4o-mini': {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        },
    },
};
