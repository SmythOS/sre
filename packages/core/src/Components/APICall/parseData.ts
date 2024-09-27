import Agent from '@sre/AgentManager/Agent.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import FormData from 'form-data';
import { Readable } from 'stream';

export async function parseData(input: any, config, agent: Agent): Promise<{ data: any; headers: any }> {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};
    const contentType = config?.data?.contentType || REQUEST_CONTENT_TYPES.none;

    let body = typeof config?.data?.body === 'string' ? config?.data?.body?.trim() : config?.data?.body;
    if (!body) {
        return { data: null, headers: {} };
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
    const { data = null, headers = {} } = await handler(body, input, config, agent);

    //const jsonBody: any = JSONContent(data).tryParse();
    return { data, headers };
}

async function handleJson(body: any, input: any, config, agent: Agent) {
    // Parse template and input variables
    //prettier-ignore
    const data = TemplateString(body)
        .parse(config.data._templateVars) //parse Template variables first (if any)
        .parse(input) //parse inputs
        .clean().result; //clean up the remaining unparsed values

    const jsonBody: any = JSONContent(data).tryParse();
    return { data: jsonBody };
}

async function handleUrlEncoded(body: any, input: any, config, agent: Agent) {
    if (typeof body === 'object') {
        const params = new URLSearchParams();
        for (const key in body) {
            params.append(key, String(body[key]));
        }
        return params.toString();
    }
    return { data: body };
}

async function handleMultipartFormData(body: any, input: any, config, agent: Agent) {
    const formData = new FormData();

    const _body = typeof body === 'string' ? JSON.parse(body) : body;

    for (const key in _body) {
        let value = _body[key];
        value = typeof value === 'boolean' ? String(value) : value;

        value = TemplateString(value).parseRaw(input).result;

        if (value && typeof value === 'object' && value?.url) {
            const binaryInput = await BinaryInput.from(value.url, '', value?.mimetype);
            const buffer = await binaryInput.getBuffer();

            const bufferStream = new Readable();
            bufferStream.push(buffer || null);
            bufferStream.push(null);

            const filename = (await binaryInput.getName()) || key;

            formData.append(key, bufferStream, { filename });
        } else if (value instanceof BinaryInput) {
            const buffer = await value.getBuffer();
            const bufferStream = new Readable();
            bufferStream.push(buffer || null);
            bufferStream.push(null);

            const filename = (await value.getName()) || key;
            formData.append(key, bufferStream, { filename });
        } else {
            value = TemplateString(value)
                .parse(config.data._templateVars) //parse Template variables first (if any)
                .parse(input)
                .clean().result;

            formData.append(key, value);

            //formData.append(key, typeof value === 'boolean' ? String(value) : value);
        }
    }
    return { data: formData, headers: formData.getHeaders() };
}

async function handleBinary(body: any, input: any, config, agent: Agent) {
    const value: any = TemplateString(body).parseRaw(input).result;

    if (value && typeof value === 'object' && value?.url) {
        const binaryInput = await BinaryInput.from(value.url, '', value?.mimetype);
        const buffer = await binaryInput.getBuffer();

        return { data: buffer, headers: { 'Content-Type': binaryInput.mimetype } };
    } else if (value && value instanceof BinaryInput) {
        const buffer = await value.getBuffer();
        return { data: buffer, headers: { 'Content-Type': value.mimetype } };
    }

    return { data: Buffer.from([]), headers: {} };
}

async function handleNone(body: any, input: any, config, agent: Agent) {
    //FIXME: try to guess the content type from headers content-type and data

    return { data: typeof body === 'string' ? body : JSON.stringify(body), headers: {} };
}
function handleText(body: any, input: any, config: any, agent: Agent) {
    // Parse template and input variables
    //prettier-ignore
    const data = TemplateString(body)
        .parse(config.data._templateVars) //parse Template variables first (if any)
        .parse(input) //parse inputs
        .clean().result; //clean up the remaining unparsed values

    return { data };
}
