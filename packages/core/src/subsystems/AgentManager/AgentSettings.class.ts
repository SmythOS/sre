import { ConnectorService } from '@sre/Core/ConnectorsService';
import EmbodimentSettings from './EmbodimentSettings.class';

import { Logger } from '@sre/helpers/Log.helper';
const console = Logger('AgentSettings');

export class AgentSettings {
    private _settings: any;
    public embodiments?: EmbodimentSettings;
    private _ready = false;

    constructor(agentId?) {
        if (agentId) {
            this.init(agentId);
        }
    }

    async init(agentId) {
        // Set embodiments before _settings allow us to use it immediately; otherwise, we need to wait both AgentSettings instance and EmbodimentSettings instance to be ready
        this.embodiments = new EmbodimentSettings(agentId);

        const agentDataConnector = ConnectorService.getAgentDataConnector();
        this._settings = (await agentDataConnector.getAgentSettings(agentId).catch((e) => {})) || {};
        this._ready = true;
    }

    public ready(maxWait = 10000) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (this._ready) {
                    clearInterval(interval);
                    resolve(true);
                }
                maxWait -= 100;
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                reject(false);
            }, maxWait);
        });
    }
    public get(key: string) {
        return this._settings?.[key] || '';
    }
    public set(key: string, value: any) {
        this._settings[key] = value;
    }
    public has(key: string) {
        return this._settings[key];
    }
}

export default AgentSettings;
