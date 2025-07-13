import { Agent } from '../../Agent/Agent.class';
export interface TTavilyWebSearchSettings {
    name?: string;
    /** Include Image Results */
    includeImages?: boolean;
    /** Sources Limit */
    sourcesLimit?: number;
    /** Search Topic */
    searchTopic?: 'general' | 'news';
    /** Include QAs */
    includeQAs?: boolean;
    /** Time Range */
    timeRange?: 'None' | 'day' | 'week' | 'month' | 'year';
    /** Include Raw Content */
    includeRawContent?: boolean;
    /** Exclude Domains */
    excludeDomains?: string;
}
export type TTavilyWebSearchInputs = {
    /** The search query to get the web search results of */
    SearchQuery?: string;
    [key: string]: any;
};
export type TTavilyWebSearchOutputs = {
    /** The web search results */
    Results: any;
    [key: string]: any;
};
/**
 * Use this component to generate a responses from an LLM
 */
export declare function TavilyWebSearch(settings?: TTavilyWebSearchSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TTavilyWebSearchOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TTavilyWebSearchInputs) => void;
};
