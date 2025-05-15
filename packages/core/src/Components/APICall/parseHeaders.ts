import { Agent } from '@sre/AgentManager/Agent.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { AxiosHeaders } from 'axios';

export async function parseHeaders(input, config, agent: Agent) {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};
    const contentType = config?.data?.contentType || REQUEST_CONTENT_TYPES.none;
    let headers = config?.data?.headers || '{}';

    //parse component template vars
    if (config.data._templateVars && templateSettings) {
        headers = await TemplateString(headers).parseComponentTemplateVarsAsync(templateSettings).asyncResult; // replaces component template vars with their IDs (this turns the string parses into an async parser) // replaces IDs with actual values then returns parser promise

        headers = await TemplateString(headers).parse(config.data._templateVars).result;
    }

    //parse vault keys
    headers = await TemplateString(headers).parseTeamKeysAsync(teamId).asyncResult;

    //parse input variables and clean up the remaining unparsed values
    headers = TemplateString(headers).parse(input).clean().result;

    //parse headers as json
    let jsonHeaders: any = JSONContent(headers).tryParse();
    if (typeof jsonHeaders !== 'object') {
        jsonHeaders = { 'x-smyth-error': 'Error parsing headers' };
    }

    //normalize headers key names to lowercase
    jsonHeaders = Object.fromEntries(Object.entries(jsonHeaders).map(([key, value]) => [key.toLowerCase(), value]));

    //if headers does not contain content-type, add it
    if (!jsonHeaders['content-type'] && contentType !== 'none') {
        jsonHeaders['content-type'] = contentType;
    }

    return new AxiosHeaders(jsonHeaders);
}
