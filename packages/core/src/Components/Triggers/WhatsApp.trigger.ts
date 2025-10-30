import { IAgent as Agent } from '@sre/types/Agent.types';
import { Trigger } from './Trigger.class';
import { AgentRequest } from '@sre/AgentManager/AgentRequest.class';
import express from 'express';

type WhatsAppIncomingMessage = {
    id?: string;
    from?: string;
    profileName?: string;
    text?: string;
    type?: string;
    timestamp?: string;
    phoneNumberId?: string;
};

export class WhatsAppTrigger extends Trigger {
    async collectPayload(input, settings, agent: Agent) {
        const req = agent.agentRequest;
        const body = req?.body || {};
        agent.agentRequest.res.sendStatus(200); //Whatsapp expects immediate response

        const message = extractFirstIncomingMessage(body);
        if (!message) return [];

        return [
            {
                message,
            },
        ];
    }

    async requestHandler(input, settings, agent: Agent) {
        const req = agent.agentRequest?.req || agent.agentRequest;
        const res = agent.agentRequest?.res;

        if (!req || !res) return null;

        const method = (req?.method || 'POST').toUpperCase();
        const query = req?.query || {};

        // Handle Facebook webhook verification (GET request)
        if (method === 'GET') {
            // Get config from request (should be attached by the router)

            const verificationResult = handleVerification(query, settings?.data);

            if (verificationResult) {
                if (verificationResult.valid) {
                    // Send plain text response with the challenge (exactly as Facebook expects)
                    res.status(200).type('text/plain').send(verificationResult.challenge);
                } else {
                    res.status(403).send('Forbidden');
                }
                return true; // Indicate that we handled the response
            }
        }

        // For POST requests (actual messages), return null to let normal flow continue
        return null;
    }

    async register(componentId: string, componentSettings: any, payload?: { triggerUrl: string }) {
        const verifyToken = componentSettings?.verifyToken || componentSettings?.verify_token;
        const clientId = componentSettings?.clientId || componentSettings?.appId;
        const clientSecret = componentSettings?.clientSecret || componentSettings?.appSecret;
        const subscriptionFields = ['messages', 'message_template_status_update'];

        const inferredWebhookUrl = payload?.triggerUrl;
        const webhookUrl = (componentSettings?.webhookUrl || inferredWebhookUrl || '').split('?')[0];

        if (!clientId || !clientSecret) throw new Error('WhatsAppTrigger.register: Missing clientId/clientSecret');
        if (!verifyToken) throw new Error('WhatsAppTrigger.register: Missing verifyToken');
        if (!webhookUrl) throw new Error('WhatsAppTrigger.register: Missing webhookUrl');

        const accessToken = await getAppAccessToken(clientId, clientSecret);

        // If a subscription exists, delete it first, then create a new one
        const existingSubscriptions = await listWebhookSubscriptions(clientId, accessToken);
        const existing = (existingSubscriptions || []).find((s: any) => s.object === 'whatsapp_business_account' && s.active);
        if (existing) {
            await deleteWebhookSubscription(clientId, accessToken);
        }

        await createWebhookSubscription(clientId, accessToken, {
            callback_url: webhookUrl,
            verify_token: verifyToken,
            fields: subscriptionFields,
        });
    }

    async unregister(componentId: string, agent: Agent, payload?: any) {
        const componentSchema = await agent.components[componentId];
        const data = componentSchema?.data || {};
        const clientId = data?.clientId || data?.appId;
        const clientSecret = data?.clientSecret || data?.appSecret;

        if (!clientId || !clientSecret) throw new Error('WhatsAppTrigger.unregister: Missing clientId/clientSecret');

        const accessToken = await getAppAccessToken(clientId, clientSecret);
        await deleteWebhookSubscription(clientId, accessToken);
    }
}

function handleVerification(query: any, config: any) {
    if (!(query?.['hub.mode'] === 'subscribe' || query?.['hub.mode'] === 'SUBSCRIBE')) return null;

    const providedToken = query['hub.verify_token'] || query['hub.verifyToken'];
    const expectedToken = config?.verifyToken || config?.verify_token;
    const challenge = query['hub.challenge'];
    const valid = expectedToken ? String(providedToken) === String(expectedToken) : false;

    return {
        valid,
        challenge,
        mode: query['hub.mode'],
    };
}

async function getAppAccessToken(clientId: string, clientSecret: string) {
    const url = 'https://graph.facebook.com/v19.0/oauth/access_token';
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
    }).toString();

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`getAppAccessToken failed: ${json?.error?.message || res.status}`);
    return json.access_token as string;
}

async function listWebhookSubscriptions(clientId: string, accessToken: string) {
    const url = `https://graph.facebook.com/v19.0/${clientId}/subscriptions`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`listWebhookSubscriptions failed: ${json?.error?.message || res.status}`);
    return json?.data || [];
}

async function deleteWebhookSubscription(clientId: string, accessToken: string) {
    const url = `https://graph.facebook.com/v19.0/${clientId}/subscriptions`;
    const body = new URLSearchParams({ object: 'whatsapp_business_account' }).toString();
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(`deleteWebhookSubscription failed: ${json?.error?.message || res.status}`);
    }
    return true;
}

async function createWebhookSubscription(
    clientId: string,
    accessToken: string,
    params: { callback_url: string; verify_token: string; fields: string[] }
) {
    const url = `https://graph.facebook.com/v19.0/${clientId}/subscriptions`;
    const body = new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: params.callback_url,
        verify_token: params.verify_token,
        fields: JSON.stringify(params.fields),
        include_values: 'true',
    }).toString();

    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`createWebhookSubscription failed: ${json?.error?.message || res.status}`);
    return json;
}

function extractFirstIncomingMessage(body: any): WhatsAppIncomingMessage | null {
    try {
        const entries = Array.isArray(body?.entry) ? body.entry : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
                const value = change?.value || {};
                const messages = Array.isArray(value?.messages) ? value.messages : [];
                if (!messages.length) continue;

                const m = messages.find((x) => x?.text?.body) || messages[0] || {};
                const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
                const contact = contacts.length ? contacts[0] : undefined;

                const text = m?.text?.body || m?.button?.text || m?.interactive?.list_reply?.title || '';
                const timestampIso = m?.timestamp ? new Date(parseInt(m.timestamp, 10) * 1000).toISOString() : undefined;

                return {
                    id: m?.id,
                    from: m?.from || contact?.wa_id,
                    profileName: contact?.profile?.name,
                    text,
                    type: m?.type,
                    timestamp: timestampIso,
                    phoneNumberId: value?.metadata?.phone_number_id,
                };
            }
        }
        return null;
    } catch {
        return null;
    }
}
