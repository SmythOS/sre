import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ManagedOAuth2Credentials } from '@sre/Security/Credentials/ManagedOAuth2Credentials.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { findAll, innerText, isTag, removeElement } from 'domutils';
import { parseDocument } from 'htmlparser2';
import { Trigger } from './Trigger.class';
export type GmailTriggerAttachment = {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
};
export type GmailTriggerMessage = {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    sizeEstimate: number;
    internalDate: string;
    headers: {
        from: string;
        to: string;
        cc: string;
        bcc: string;
        subject: string;
        date: string;
        messageId: string;
    };
    body: {
        text: string;
        html: string;
    };
    attachments: GmailTriggerAttachment[];
    isUnread: true;
};
export class GmailTrigger extends Trigger {
    async collectPayload(input, config, agent: Agent) {
        const credentialsKey = config?.data?.oauth_cred_id;
        const agentCandidate = AccessCandidate.agent(agent.id);
        const oauth2Credentials = await ManagedOAuth2Credentials.load(credentialsKey, agentCandidate);

        console.log(
            oauth2Credentials.accessToken,
            oauth2Credentials.refreshToken,
            oauth2Credentials.expiresIn,
            oauth2Credentials.scope,
            oauth2Credentials.tokenUrl,
            oauth2Credentials.service
        );

        await oauth2Credentials.refreshAccessToken();

        const messages = await getMostRecentUnreadMessage(0, oauth2Credentials, 5);
        return messages;
    }
}

/**
 * Make an authenticated Gmail API request
 */
async function gmailApiRequest(endpoint, accessToken) {
    const url = `https://www.googleapis.com/gmail/v1/users/me${endpoint}`;

    try {
        const result = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const json = await result.json();
        console.log(json);
        return json;
    } catch (error) {
        throw new Error(`Gmail API request failed: ${error.message}`);
    }
}

/**
 * Get the most recent unread messages
 */
async function getMostRecentUnreadMessage(
    retryCount = 0,
    oauth2Credentials: ManagedOAuth2Credentials,
    numMessages: number = 1,
    excludeMessageId?: string
) {
    const MAX_RETRIES = 1; // Only retry once to prevent infinite loops

    let accessToken = oauth2Credentials.accessToken;

    // If no access token provided, or if requests fail, refresh it
    if (!accessToken) {
        accessToken = await oauth2Credentials.refreshAccessToken();
    }

    try {
        console.log('Fetching unread messages...');

        const collectedIds: string[] = [];
        let pageToken: string | undefined = undefined;
        let reachedBoundary = false;

        while (collectedIds.length < numMessages && !reachedBoundary) {
            const pageSize = Math.min(Math.max(numMessages, 1), 100);
            const pageQuery = `/messages?q=is:unread&maxResults=${pageSize}${pageToken ? `&pageToken=${pageToken}` : ''}`;
            const listResponse = await gmailApiRequest(pageQuery, accessToken);

            const messages = Array.isArray(listResponse.messages) ? listResponse.messages : [];
            if (messages.length === 0) {
                break;
            }

            for (const m of messages) {
                if (excludeMessageId && m.id === excludeMessageId) {
                    reachedBoundary = true;
                    break;
                }
                collectedIds.push(m.id);
                if (collectedIds.length >= numMessages) {
                    break;
                }
            }

            if (collectedIds.length >= numMessages || reachedBoundary || !listResponse.nextPageToken) {
                break;
            }
            pageToken = listResponse.nextPageToken;
        }

        if (collectedIds.length === 0) {
            return [];
        }

        // Fetch full message details in parallel
        const details = await Promise.all(collectedIds.map((id) => gmailApiRequest(`/messages/${id}?format=full`, accessToken)));
        const parsed = details.map((d) => parseMessage(d));
        return parsed;
    } catch (error) {
        // If token expired, try refreshing and retry once
        if ((error.message.includes('401') || error.message.includes('unauthorized')) && retryCount < MAX_RETRIES) {
            console.log('Access token expired, refreshing...');
            try {
                accessToken = await oauth2Credentials.refreshAccessToken();
                return await getMostRecentUnreadMessage(retryCount + 1, oauth2Credentials, numMessages, excludeMessageId);
            } catch (refreshError) {
                throw new Error(`Authentication failed: ${refreshError.message}`);
            }
        }

        throw error;
    }
}

/**
 * Parse Gmail message into structured format
 */
function parseMessage(message) {
    const headers: any = {};
    const payload = message.payload || {};

    // Extract headers
    if (payload.headers) {
        payload.headers.forEach((header) => {
            headers[header.name.toLowerCase()] = header.value;
        });
    }

    // Extract body content
    let textBody = '';
    let htmlBody = '';

    function extractBody(part) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
            htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }

        if (part.parts) {
            part.parts.forEach(extractBody);
        }
    }

    if (payload.parts) {
        payload.parts.forEach(extractBody);
    } else if (payload.body && payload.body.data) {
        // Single part message
        if (payload.mimeType === 'text/plain') {
            textBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.mimeType === 'text/html') {
            htmlBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
    }

    if (textBody && !htmlBody) {
        htmlBody = textBody;
    }

    if (htmlBody && !textBody) {
        textBody = htmlToPlainText(htmlBody);
    }

    // Get attachments info
    const attachments = [];
    function findAttachments(part) {
        if (part.filename && part.filename.length > 0) {
            attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body ? part.body.size : 0,
                attachmentId: part.body ? part.body.attachmentId : null,
            });
        }

        if (part.parts) {
            part.parts.forEach(findAttachments);
        }
    }

    if (payload.parts) {
        payload.parts.forEach(findAttachments);
    }

    return {
        email: {
            id: message.id,
            threadId: message.threadId,
            labelIds: message.labelIds || [],
            snippet: message.snippet || '',
            sizeEstimate: message.sizeEstimate || 0,
            internalDate: message.internalDate ? new Date(parseInt(message.internalDate)).toISOString() : null,
            headers: {
                from: headers.from || '',
                to: headers.to || '',
                cc: headers.cc || '',
                bcc: headers.bcc || '',
                subject: headers.subject || '',
                date: headers.date || '',
                messageId: headers['message-id'] || '',
            },
            body: {
                text: textBody,
                html: htmlBody,
            },
            attachments: attachments,
            isUnread: message.labelIds ? message.labelIds.includes('UNREAD') : false,
        },
    };
}

var populateChar = function (ch, amount) {
    var result = '';
    for (var i = 0; i < amount; i += 1) {
        result += ch;
    }
    return result;
};

function htmlToPlainText(htmlText, _styleConfig?) {
    try {
        const document = parseDocument(String(htmlText));
        const nodesToRemove = findAll((node) => isTag(node) && (node.name === 'script' || node.name === 'style'), document.children);
        nodesToRemove.forEach((node) => removeElement(node));

        let text = innerText(document);

        text = text.replace(/\u00A0/g, ' ');
        text = text.replace(/\r\n?/g, '\n');
        text = text.replace(/\t+/g, ' ');
        text = text.replace(/[ \t\f]+\n/g, '\n');
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/[ ]{2,}/g, ' ');
        text = text.replace(/^\s+|\s+$/g, '');

        if (text.length === 0 || text.lastIndexOf('\n') !== text.length - 1) {
            text += '\n';
        }
        return text;
    } catch (err) {
        return String(htmlText);
    }
}

// dkronClient.js
import fetch from 'node-fetch';

/**
 * Create or update a Dkron job
 * @param {string} id - Unique job ID
 * @param {object} metadata - Arbitrary metadata object
 * @param {string} url - URL to call
 * @param {object|string} body - Request body (object will be JSON stringified)
 * @param {object} headers - HTTP headers
 * @param {string} schedule - Cron or frequency expression (e.g. "@every 1m" or "0 * * * * *")
 */
export async function createDkronJob(id, metadata, url, body, headers, schedule) {
    const jobDefinition = {
        name: id,
        schedule,
        timezone: 'UTC',
        owner: 'nodejs-client',
        disabled: false,
        metadata,
        executor: 'http',
        executor_config: {
            url,
            method: 'POST',
            headers: JSON.stringify(headers || {}),
            body: typeof body === 'object' ? JSON.stringify(body) : body,
        },
    };

    const res = await fetch('http://localhost:8080/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobDefinition),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create job: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data;
}

/**
 * Delete a Dkron job by ID
 * @param {string} id - Job ID
 */
export async function deleteDkronJob(id) {
    const res = await fetch(`http://localhost:8080/v1/jobs/${id}`, {
        method: 'DELETE',
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete job: ${res.status} ${errorText}`);
    }

    return { success: true };
}
