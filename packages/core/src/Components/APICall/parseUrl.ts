import Agent from '@sre/AgentManager/Agent.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

function decodeUriParts(url: string): string {
    try {
        const urlObj = new URL(url);
        urlObj.pathname = decodeURIComponent(urlObj.pathname);

        // Handle search params individually
        const searchParams = new URLSearchParams(urlObj.search);
        for (const [key, value] of searchParams.entries()) {
            try {
                const decodedKey = decodeURIComponent(key);
                const decodedValue = decodeURIComponent(value);
                searchParams.delete(key);
                searchParams.append(decodedKey, decodedValue);
            } catch (paramError) {
                console.warn(`Failed to decode search parameter: ${key}=${value}`, paramError);
                // Keep the original key-value pair
            }
        }
        urlObj.search = searchParams.toString();

        urlObj.hash = decodeURIComponent(urlObj.hash);
        return urlObj.toString();
    } catch (error) {
        console.warn('Failed to decode URL parts, proceeding with original value:', error);
        return url;
    }
}

export async function parseUrl(input, config, agent: Agent) {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};

    let url = config?.data?.url;

    // Decode URL parts
    url = decodeURIComponent(url);

    //parse component template vars
    if (config.data._templateVars && templateSettings) {
        url = await TemplateString(url).parseComponentTemplateVarsAsync(templateSettings).asyncResult; // replaces component template vars with their IDs (this turns the string parses into an async parser) // replaces IDs with actual values then returns parser promise

        url = await TemplateString(url).parse(config.data._templateVars).result;
    }

    //parse vault keys
    url = await TemplateString(url).parseTeamKeysAsync(teamId).asyncResult;

    //parse input variables and clean up the remaining unparsed values
    url = TemplateString(url).parse(input).clean().result;

    // Decode URL parts again after all parsing is done
    url = decodeURIComponent(url);

    //URL will take care of encoding the url properly
    const urlObj = new URL(url);

    //urlObj.href will return the encoded url
    return urlObj.href;
}
