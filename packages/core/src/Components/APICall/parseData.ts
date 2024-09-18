import Agent from '@sre/AgentManager/Agent.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

export async function parseData(input, config, agent: Agent) {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};
    let body = config?.data?.body.trim();
    if (!body) {
        return undefined;
    }

    //parse component template vars
    if (config.data._templateVars && templateSettings) {
        body = await TemplateString(body)
            .parseComponentTemplateVarsAsync(templateSettings) // replaces component template vars with their IDs (this turns the string parses into an async parser)
            .parse(config.data._templateVars).asyncResult; // replaces IDs with actual values then returns parser promise
    }

    //parse vault keys
    body = await TemplateString(body).parseTeamKeysAsync(teamId).asyncResult;

    //parse input variables and clean up the remaining unparsed values
    body = TemplateString(body).parse(input).clean().result;

    const jsonBody: any = JSONContent(body).tryParse();
    return jsonBody;
}
