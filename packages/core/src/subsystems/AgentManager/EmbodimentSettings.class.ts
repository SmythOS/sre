import { Logger } from '@sre/helpers/Log.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
const console = Logger('EmbodimentSettings');

export class EmbodimentSettings {
    private _embodiments: any;
    private _ready = false;

    constructor(agentId) {
        this.init(agentId);
    }

    async init(agentId) {
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        this._embodiments = await agentDataConnector.getAgentEmbodiments(agentId).catch((error) => []);
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

    public get(embodimentType: string, key?: string) {
        if (!this._embodiments) return undefined;
        const _embodiment = this._embodiments.find((embodiment: any) => embodiment.type?.toLowerCase() === embodimentType.toLowerCase());

        if (!_embodiment) {
            //console.error(`Error: No ${embodimentType} embodiment found for agent`);
        }
        if (key) {
            return _embodiment?.properties?.[key];
        }
        return _embodiment?.properties;
    }

    public getAll() {
        const obj = {};
        this._embodiments.forEach((embodiment: any) => {
            obj[embodiment.type.toLowerCase()] = embodiment.properties;
        });
        return obj;
    }
}
