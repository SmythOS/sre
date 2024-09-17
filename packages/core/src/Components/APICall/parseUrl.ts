import Agent from '@sre/AgentManager/Agent.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

export async function parseUrl(input, config, agent: Agent) {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};

    let url = config?.data?.url;

    url = decodeURIComponent(url); //decode the url in order to parse the template vars

    //parse component template vars
    if (config.data._templateVars && templateSettings) {
        url = await TemplateString(url)
            .parseComponentTemplateVarsAsync(templateSettings) // replaces component template vars with their IDs (this turns the string parses into an async parser)
            .parse(config.data._templateVars).asyncResult; // replaces IDs with actual values then returns parser promise
    }

    //parse vault keys
    url = await TemplateString(url).parseTeamKeysAsync(teamId).asyncResult;

    //parse input variables and clean up the remaining unparsed values
    url = TemplateString(url).parse(input).clean().result;

    //URL will take care of encoding the url properly
    const urlObj = new URL(url);

    //urlObj.href will return the encoded url
    return urlObj.href;
}
