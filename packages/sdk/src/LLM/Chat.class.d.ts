import { TLLMModel, Conversation, AccessCandidate } from '@smythos/sre';
import { EventEmitter } from 'events';
import { AgentData, ChatOptions } from '../types/SDKTypes';
import { SDKObject } from '../Core/SDKObject.class';
declare class ChatCommand {
    private prompt;
    private chat;
    private _conversation;
    constructor(prompt: string, chat: Chat);
    then(resolve: (value: string) => void, reject?: (reason: any) => void): Promise<void>;
    private run;
    /**
     * Execute the chat command as a streaming response.
     *
     * **Available Events:**
     * - `'data'` - Text chunk received from the agent
     * - `'end'` - The agent has finished responding
     * - `'error'` - The agent encountered an error
     *
     * @returns Promise that resolves to an EventEmitter for streaming updates
     *
     * @example
     * ```typescript
     * const chat = agent.chat('my_chat_id');
     *
     * const stream = await chat.prompt("Tell me a long story").stream();
     * stream.on('data', (chunk) => process.stdout.write(chunk));
     * stream.on('end', () => console.log('\nStory completed!'));
     * stream.on('error', (err) => console.error('Error:', err));
     * ```
     */
    stream(): Promise<EventEmitter>;
}
export declare class Chat extends SDKObject {
    private _convOptions;
    private _id;
    _conversation: Conversation;
    get id(): string;
    private _data;
    get agentData(): any;
    constructor(options: ChatOptions & {
        candidate: AccessCandidate;
    }, _model: string | TLLMModel, _data?: any, _convOptions?: any);
    private isValidPersistanceObject;
    protected init(): Promise<void>;
    /**
     * Send a prompt to the chat and get a response.
     *
     * The returned command can be executed in multiple ways:
     * - **Promise mode**: `await chat.prompt("question")` - returns final result
     * - **Explicit execution**: `await chat.prompt("question").run()` - same as above
     * - **Streaming mode**: `await chat.prompt("question").stream()` - returns event emitter
     *
     * @example
     * ```typescript
     * const chat = agent.chat('my_chat_id');
     *
     * // Simple prompt (promise mode)
     * const answer = await chat.prompt("What is the capital of France?");
     *
     *
     * // Streaming for long responses
     * const stream = await chat.prompt("Write a detailed report").stream();
     * stream.on('data', chunk => console.log(chunk));
     * stream.on('end', () => console.log('Complete!'));
     * ```
     *
     * @param prompt - The message or question to send to the chat
     * @returns ChatCommand that can be executed or streamed
     */
    prompt(prompt: string): ChatCommand;
}
export declare function prepareConversation(agentData: AgentData, options?: any): Promise<any>;
export {};
