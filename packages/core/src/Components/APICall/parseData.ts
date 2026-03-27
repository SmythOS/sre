import { Agent } from '@sre/AgentManager/Agent.class';
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
    const data = TemplateString(body)
        .parse(config.data._templateVars) //parse Template variables first (if any)
        .parse(input) //parse inputs
        .clean().result; //clean up the remaining unparsed values

    const jsonData: any = JSONContent(data).tryParse();

    if (typeof jsonData === 'object') {
        const params = new URLSearchParams();
        for (const key in jsonData) {
            params.append(key, String(jsonData[key]));
        }
        return { data: params.toString() };
    }

    return { data: jsonData };
}

async function handleMultipartFormData(body: any, input: any, config, agent: Agent) {
    const formData = new FormData();

    const _body = typeof body === 'string' ? JSON.parse(body) : body;

    for (const key in _body) {
        let value = _body[key];
        value = typeof value === 'boolean' ? String(value) : value;

        value = TemplateString(value).parseRaw(input).result;

        // * Note: It's important to check if the value is an instance of BinaryInput first.
        // Otherwise, condition like (value && typeof value === 'object' && value?.url)
        // might be true and lead to incorrect results.
        if (value instanceof BinaryInput) {
            const buffer = await value.getBuffer();
            const bufferStream = new Readable();
            bufferStream.push(buffer || null);
            bufferStream.push(null);

            const filename = (await value.getName()) || key;
            formData.append(key, bufferStream, {
                filename,
                contentType: value.mimetype,
            });
        } else if (value && typeof value === 'object' && value?.url) {
            // Retro compatibility with old binary data structure {url: '...', mimetype: '...', url: 'http(s)://...'}
            const binaryInput = await BinaryInput.from(value.url, '', value?.mimetype);
            const buffer = await binaryInput.getBuffer();

            const bufferStream = new Readable();
            bufferStream.push(buffer || null);
            bufferStream.push(null);

            const filename = (await binaryInput.getName()) || key;
            formData.append(key, bufferStream, {
                filename,
                contentType: binaryInput.mimetype,
            });
        } else {
            value = TemplateString(value)
                .parse(config.data._templateVars) //parse Template variables first (if any)
                .parse(input)
                .clean().result;

            if (value) {
                formData.append(key, value);
            }

            //formData.append(key, typeof value === 'boolean' ? String(value) : value);
        }
    }
    return { data: formData, headers: formData.getHeaders() };
}

async function handleBinary(body: any, input: any, config, agent: Agent) {
    const value: any = TemplateString(body).parseRaw(input).result;

    // * Note: It's important to check if the value is an instance of BinaryInput first.
    // Otherwise, condition like (value && typeof value === 'object' && value?.url)
    // might be true and lead to incorrect results.
    if (value && value instanceof BinaryInput) {
        const buffer = await value.getBuffer();
        return { data: buffer, headers: { 'Content-Type': value.mimetype } };
    } else if (value && typeof value === 'object' && value?.url) {
        // Retro compatibility with old binary data structure {url: '...', mimetype: '...', url: 'http(s)://...'}
        const binaryInput = await BinaryInput.from(value.url, '', value?.mimetype);
        const buffer = await binaryInput.getBuffer();

        return { data: buffer, headers: { 'Content-Type': binaryInput.mimetype } };
    }

    return { data: Buffer.from([]), headers: {} };
}

async function handleNone(body: any, input: any, config, agent: Agent) {
    // Try to guess the content type from headers content-type and data
    const configHeaders = config?.headers || {};
    const contentTypeHeader = configHeaders['content-type'] || configHeaders['Content-Type'];
    
    // If content-type is explicitly set in headers, delegate to appropriate handler
    if (contentTypeHeader) {
        if (contentTypeHeader.includes('application/json')) {
            return await handleJson(body, input, config, agent);
        } else if (contentTypeHeader.includes('application/x-www-form-urlencoded')) {
            return await handleUrlEncoded(body, input, config, agent);
        } else if (contentTypeHeader.includes('multipart/form-data')) {
            return await handleMultipartFormData(body, input, config, agent);
        } else if (contentTypeHeader.includes('text/')) {
            return handleText(body, input, config, agent);
        }
    }
    
    // Attempt to guess content type from data structure
    if (typeof body === 'string') {
        const trimmedBody = body.trim();
        
        // Check if it looks like JSON
        if ((trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) || 
            (trimmedBody.startsWith('[') && trimmedBody.endsWith(']'))) {
            try {
                JSON.parse(trimmedBody);
                return await handleJson(body, input, config, agent);
            } catch {
                // Not valid JSON, continue with default handling
            }
        }
        
        // Check if it looks like URL-encoded data
        if (trimmedBody.includes('=') && !trimmedBody.includes(' ') && 
            !trimmedBody.includes('\n') && !trimmedBody.includes('<')) {
            return await handleUrlEncoded(body, input, config, agent);
        }
        
        // Default to text handling for strings
        return handleText(body, input, config, agent);
    }
    
    // For objects, try JSON handling
    if (typeof body === 'object' && body !== null) {
        return await handleJson(JSON.stringify(body), input, config, agent);
    }

    // Fallback to original behavior
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
