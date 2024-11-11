import { OpenAI } from 'openai';
import { Conversation } from '../../../../../src';
import crypto from 'crypto';
import { Readable } from 'stream';
import { faker } from '@faker-js/faker';
import { Request, Response } from 'express';

class OpenAIChatService {
    async chatCompletion(
        agentId: string,
        params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,

        options?: {
            include_status?: boolean;
        }
    ): Promise<OpenAI.Chat.Completions.ChatCompletion | Readable> {
        const systemPrompt = params.messages
            .filter((m) => m.role === 'system')
            .map((m) => m.content)
            .join('\n');
        const conv = new Conversation(params.model, agentId);
        await conv.ready;
        conv.systemPrompt = systemPrompt;

        const history = params.messages.filter((m) => m.role !== 'system');
        const lastUserMessageIndx = history.length - 1 - [...history].reverse().findIndex((m) => m.role === 'user');
        // remove the last user message from the history
        const lastUserMessage = history.splice(lastUserMessageIndx, 1)[0];

        for (const message of history) {
            switch (message.role) {
                case 'user':
                    const id = crypto.randomUUID();
                    conv.context.addUserMessage(message.content as string, id);
                    break;
                case 'assistant':
                    const id2 = crypto.randomUUID();
                    conv.context.addAssistantMessage(message.content as string, id2);
                    break;
                // case 'tool':
                //     const id3 = crypto.randomUUID();
                //     conv.context.addToolMessage(message.content, id3);
                //     break;
            }
        }

        const completionId = `chatcmpl-${crypto.randomUUID()}`;
        const now = Date.now();
        if (params.stream) {
            // return this.fakeStream();
            const readable = new Readable({
                read() {},
            });

            conv.on('content', (content) => {
                const preparedContent: OpenAI.Chat.Completions.ChatCompletionChunk = {
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created: now,
                    model: params.model,
                    choices: [{ index: 0, delta: { content }, finish_reason: null }],
                    system_fingerprint: undefined,
                };
                options?.include_status && this.randomlyEmitStatus(readable, completionId, now, params); // for PoC
                readable.push(`data: ${JSON.stringify(preparedContent)}\n\n`);
            });

            conv.on('end', () => {
                console.log('streaming: [DONE]');
                readable.push('data: [DONE]\n\n');
                readable.push(null);
            });

            conv.on('error', (error) => {
                console.log('streaming: error', error);
                readable.emit('error', error);
            });

            conv.streamPrompt(lastUserMessage?.content as string, {
                'X-AGENT-ID': agentId,
            }).catch((error) => {
                readable.emit('error', error);
            });

            return readable;
        } else {
            const result = (await conv.prompt(lastUserMessage?.content as string, {
                'X-AGENT-ID': agentId,
            })) as string;

            return {
                id: completionId,
                object: 'chat.completion',
                created: now,
                model: params.model,
                choices: [{ index: 0, message: { role: 'assistant', content: result }, logprobs: null, finish_reason: 'stop' }],
            };
        }
    }

    private firstTime = true;
    private randomlyEmitStatus(
        readable: Readable,
        completionId: string,
        now: number,
        params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
    ) {
        const shouldEmitStatus = this.firstTime || Math.random() < 0.5;
        this.firstTime && (this.firstTime = false);

        const randomToolStatus = [
            { text: 'Thinking', pauseDelay: 5_000 },
            { text: 'Analyzing', pauseDelay: 5_000 },
        ];
        if (shouldEmitStatus) {
            const status = randomToolStatus.pop();
            if (!status) return;
            const statusChunk: OpenAI.Chat.Completions.ChatCompletionChunk & {
                choices: { index: number; delta: { content: string; status: string }; finish_reason: string | null }[];
            } = {
                id: completionId,
                object: 'chat.completion.chunk',
                created: now,
                model: params.model,
                choices: [{ index: 0, delta: { content: '', status: status.text }, finish_reason: null }],
                system_fingerprint: undefined,
            };
            readable.push(`data: ${JSON.stringify(statusChunk)}\n\n`);
            readable.pause();
            setTimeout(() => {
                readable.resume();
            }, status.pauseDelay);
        }
    }

    private fakeStream() {
        // just fake a stream with dummy data
        const readable = new Readable({
            read() {},
        });

        const sentences = faker.lorem.sentences(10);

        for (const sentence of sentences) {
            const preparedContent: OpenAI.Chat.Completions.ChatCompletionChunk = {
                id: crypto.randomUUID(),
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'gpt-4o-mini',
                choices: [{ index: 0, delta: { content: sentence }, finish_reason: null }],
                system_fingerprint: undefined,
            };
            readable.push(`data: ${JSON.stringify(preparedContent)}\n\n`);
        }

        readable.push('data: [DONE]\n\n');
        readable.push(null);
        return readable;
    }
}

export const chatService = new OpenAIChatService();
