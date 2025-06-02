import { Conversation } from '@sre/helpers/Conversation.helper';
import { uid } from '@sre/utils/general.utils';
import { EventEmitter } from 'events';

class ChatCommand {
    constructor(
        private prompt: string,
        private _conversation: Conversation,
    ) {}

    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    private async run(): Promise<string> {
        const result = await this._conversation.streamPrompt(this.prompt);
        return result;
    }

    async stream(): Promise<EventEmitter> {
        this._conversation.streamPrompt(this.prompt);
        return this._conversation;
    }
}

export class Chat {
    private _conversation: Conversation;
    private _data: any = {
        version: '1.0.0',
        name: 'Agent',
        behavior: '',
        components: [],
        connections: [],
        defaultModel: '',
        agentId: uid(),
    };
    constructor(
        private _model: string,
        _data?: any,
        private _options?: any,
    ) {
        this._data = { ...this._data, ...this._data };

        this._conversation = new Conversation(this._model, this._data, this._options);
    }

    prompt(prompt: string) {
        return new ChatCommand(prompt, this._conversation);
    }
}
