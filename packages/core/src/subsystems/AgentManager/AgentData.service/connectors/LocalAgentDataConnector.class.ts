import { parseCLIArgs } from '@sre/utils/cli.utils';
import fs from 'fs';
import path from 'path';
import { AgentDataConnector } from '../AgentDataConnector';
import { uid } from '@sre/utils/general.utils';

type LocalAgentDataSettings = { directory: string };

/**
 * This connector loads Agent data and settings from a provided directory, it then indexes the loaded agents and settings by agent IDs.
 * Agent data files should be in JSON format and contain an 'id' field with the agent ID and at least a 'components' field.
 * Settings files should be in JSON format and contain an 'id' field with the agent ID and the settings in a 'settings' field.
 *     'settings' field is a key-value object with the Agent settings.
 */
export class LocalAgentDataConnector extends AgentDataConnector {
    public name: string = 'LocalAgentDataConnector';
    private directory;
    private agentsData = {};
    private agentSettings = {};

    constructor(settings: LocalAgentDataSettings) {
        super();
        this.directory = settings.directory;
    }
    private indexAgentsData() {
        const agents = fs.readdirSync(this.directory);

        for (const agent of agents) {
            const agentData = fs.readFileSync(path.join(this.directory, agent), 'utf8');
            let jsonData;
            try {
                jsonData = JSON.parse(agentData);

                if (!jsonData.id) {
                    console.warn(`Agent data for ${agent} does not contain an id, generating one...`);
                    jsonData.id = 'tmp-' + uid();
                }
            } catch (e) {
                console.warn(`Error parsing agent data for ${agent}: ${e.message}`);
            }

            //is this an agent data file?
            if (jsonData.components) this.agentsData[jsonData.id] = jsonData;

            //does this file contain settings?
            if (jsonData.settings) this.agentSettings[jsonData.id] = jsonData.settings;
        }
    }
    public async start() {
        super.start();
        this.started = false;
        this.indexAgentsData();
        this.started = true;
    }
    public async getAgentData(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }

        if (this.agentsData[agentId]) {
            return { data: this.agentsData[agentId], version: version || '1.0' };
        } else {
            throw new Error(`Agent with id ${agentId} not found`);
        }
    }

    public getAgentIdByDomain(domain: string): Promise<string> {
        return Promise.resolve('');
    }
    public async getAgentSettings(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }

        if (this.agentSettings[agentId]) {
            return this.agentSettings[agentId];
        } else {
            throw new Error(`Settings for agent with id ${agentId} not found`);
        }
    }
}
