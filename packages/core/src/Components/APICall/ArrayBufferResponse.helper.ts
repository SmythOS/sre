import { Agent } from '@sre/AgentManager/Agent.class';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { isBinaryData, isBinaryMimeType } from '@sre/utils/data.utils';
import { AxiosResponse } from 'axios';
import mimeTypeCategories from './mimeTypeCategories';

const contentHandlers = {
    json: parseJson,
    text: parseText,
    binary: parseBinary,
};

function parseJson(data) {
    return JSON.parse(Buffer.from(data).toString('utf8') || '{}');
}

function parseText(data) {
    return Buffer.from(data).toString('utf8');
}

async function parseBinary(data, contentType, agentId) {
    const binaryInput = BinaryInput.from(data, null, contentType);
    const smythFile = await binaryInput.getJsonData(AccessCandidate.agent(agentId));

    return smythFile;
}

export async function parseArrayBufferResponse(response: AxiosResponse, agent: Agent): Promise<any> {
    if (!response?.data) {
        return null;
    }
    const data = response.data;
    const contentType = response.headers['content-type'];
    const cleanContentType = contentType?.split(';')[0];

    // Try to find an exact match first,
    let handlerType = Object.keys(mimeTypeCategories).find((type) => mimeTypeCategories[type].includes(cleanContentType));

    // If no exact match, try to find a match for the first part of the handlerTypes, some handlers are generic like text/ in that case we check if the handler is a substring of the contentType
    if (!handlerType) {
        handlerType = Object.keys(mimeTypeCategories).find((type) => mimeTypeCategories[type].some((prefix) => cleanContentType?.startsWith(prefix)));
    }

    const handler = contentHandlers[handlerType];

    if (handler) {
        return handler(data, contentType, agent.id);
    }

    // Fallback: if no content type matches then check if the data is binary
    // If so then parse it as binary, otherwise parse it as text
    if (isBinaryMimeType(contentType) || isBinaryData(data)) {
        return parseBinary(data, contentType, agent.id);
    } else {
        return parseText(data);
    }
}
