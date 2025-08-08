import { SearchToolCostConfig } from '../types';

export const MODELS_WITHOUT_TEMPERATURE_SUPPORT = ['o3-pro', 'o4-mini'];
export const MODELS_WITHOUT_PRESENCE_PENALTY_SUPPORT = ['o4-mini'];
export const MODELS_WITHOUT_JSON_RESPONSE_SUPPORT = ['o1-preview'];
export const MODELS_WITHOUT_SYSTEM_MESSAGE_SUPPORT = ['o1-mini', 'o1-preview'];

/**
 * Search tool cost configuration
 * Costs are in dollars per 1000 calls
 *
 * Pricing tiers:
 * - gpt-4o, gpt-4.1 (and their mini variants): $25.00 / 1k calls (search content tokens free)
 * - gpt-5 (and variants): $10.00 / 1k calls (search content tokens billed at input rates)
 */
export const SEARCH_TOOL_COSTS: SearchToolCostConfig = {
    // gpt-4o and gpt-4.1 models: $25/1k calls (search content tokens free)
    gpt4Models: {
        'gpt-4.1': 25 / 1000,
        'gpt-4o': 25 / 1000,
        'gpt-4.1-mini': 25 / 1000,
        'gpt-4o-mini': 25 / 1000,
    },
    // gpt-5 models: $10/1k calls (search content tokens billed separately)
    gpt5Models: {
        'gpt-5': 10 / 1000,
        'gpt-5-mini': 10 / 1000,
        'gpt-5-nano': 10 / 1000,
    },
};
