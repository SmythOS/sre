import Agent from '@sre/AgentManager/Agent.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';

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

    let url = config?.data?.url.replace(/\+/g, '%20'); // replace + with %20 from query params to make it a valid url

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
    //url = decodeURIComponent(url); //This seems to be causing issues with some variables being encoded while they should not be

    //URL will take care of encoding the url properly
    const urlObj = new URL(url);

    //urlObj.href will return the encoded url
    return urlObj.href;
}

export async function parseSmythFsUrl(url: string, agent: Agent) {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    const publicUrls: string[] = [];

    for (const [key, value] of searchParams.entries()) {
        if (value.startsWith('smythfs://')) {
            const pubUrl = await SmythFS.Instance.genTempUrl(value, AccessCandidate.agent(agent.id));
            publicUrls.push(pubUrl);
            searchParams.set(key, pubUrl);
        }
    }

    return { url: urlObj.href, publicUrls };
}

export async function destroyPublicUrls(publicUrls: string[]): Promise<boolean> {
    try {
        await Promise.all(publicUrls.map((url) => SmythFS.Instance.destroyTempUrl(url)));
        console.log('Successfully cleaned up all temp urls for API Call Component');
    } catch (error) {
        console.warn('Failed to clean up temp urls for API Call Component:', error);
    }

    return true;
}
