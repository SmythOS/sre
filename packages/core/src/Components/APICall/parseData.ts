import Agent from '@sre/AgentManager/Agent.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';

export async function parseData(input: any, config, agent: Agent) {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};
    const contentType = config?.data?.contentType || REQUEST_CONTENT_TYPES.none;

    let body = typeof config?.data?.body === 'string' ? config?.data?.body?.trim() : config?.data?.body;
    if (!body) {
        return undefined;
    }

    // Parse component template variables
    if (config.data._templateVars && templateSettings) {
        //prettier-ignore
        body = await TemplateString(body) 
            .parseComponentTemplateVarsAsync(templateSettings) // replace component template vars with their IDs (this turns the string parses into an async parser)            
            .asyncResult; //returns parser promise
    }

    // Parse vault keys
    body = await TemplateString(body).parseTeamKeysAsync(teamId).asyncResult;

    // Handle different content types
    const handlers: Record<string, (parsedBody: any, input: any, config, agent: Agent) => any> = {
        [REQUEST_CONTENT_TYPES.json]: handleJson,
        [REQUEST_CONTENT_TYPES.urlEncodedFormData]: handleUrlEncoded,
        [REQUEST_CONTENT_TYPES.multipartFormData]: handleMultipartFormData,
        [REQUEST_CONTENT_TYPES.binary]: handleBinary,
        [REQUEST_CONTENT_TYPES.text]: handleText,
        [REQUEST_CONTENT_TYPES.none]: handleNone,
    };

    const handler = handlers[contentType] || handleNone;
    const data = await handler(body, input, config, agent);

    //const jsonBody: any = JSONContent(data).tryParse();
    return data;
}

async function handleJson(body: any, input: any, config, agent: Agent) {
    // Parse template and input variables
    //prettier-ignore
    const data = TemplateString(body)
        .parse(config.data._templateVars) //parse Template variables first (if any)
        .parse(input) //parse inputs
        .clean().result; //clean up the remaining unparsed values

    const jsonBody: any = JSONContent(data).tryParse();
    return jsonBody;
}

async function handleUrlEncoded(body: any, input: any, config, agent: Agent) {
    if (typeof body === 'object') {
        const params = new URLSearchParams();
        for (const key in body) {
            params.append(key, String(body[key]));
        }
        return params.toString();
    }
    return body;
}

async function handleMultipartFormData(body: any, input: any, config, agent: Agent) {
    const formData = new FormData();
    for (const key in body) {
        const value = body[key];

        if (value && typeof value === 'object' && value.url) {
            const binaryInput = await BinaryInput.from(value, value.name, value.mimetype);
            const buffer = await binaryInput.getBuffer();
            const blob = new Blob([buffer], { type: value.mimetype });
            formData.append(key, blob, value.filename);
        } else {
            let data = typeof value === 'boolean' ? String(value) : value;
            data = TemplateString(data)
                .parse(config.data._templateVars) //parse Template variables first (if any)
                .parse(input)
                .clean().result;

            formData.append(key, data);

            //formData.append(key, typeof value === 'boolean' ? String(value) : value);
        }
    }
    return formData;
}

async function handleBinary(body: any, input: any, config, agent: Agent) {
    const regex = /{{(.*?)}}/;
    const match = typeof body === 'string' ? body.match(regex) : null;
    const key = match ? match[1] : '';
    const data = input?.[key];
    if (data && data instanceof BinaryInput) {
        //const binaryInput = BinaryInput.from(data, data.name, data.mimetype, AccessCandidate.agent(agent.id));
        const buffer = await data.getBuffer();
        return buffer;
    }
    return Buffer.from([]);
}

async function handleNone(body: any, input: any, config, agent: Agent) {
    //FIXME: try to guess the content type from headers content-type and data

    return typeof body === 'string' ? body : JSON.stringify(body);
}
function handleText(body: any, input: any, config: any, agent: Agent) {
    // Parse template and input variables
    //prettier-ignore
    const data = TemplateString(body)
        .parse(config.data._templateVars) //parse Template variables first (if any)
        .parse(input) //parse inputs
        .clean().result; //clean up the remaining unparsed values

    return data;
}
