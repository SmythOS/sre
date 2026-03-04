import fs from 'fs';
import path from 'path';
import { AgentDataConnector } from '../AgentDataConnector';
import { uid } from '@sre/utils/general.utils';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('LocalAgentDataConnector');

export type LocalAgentDataSettings = { devDir: string; prodDir: string };

/**
 * This connector loads Agent data and settings from a provided directory, it then indexes the loaded agents and settings by agent IDs.
 * Agent data files should be in JSON format and contain an 'id' field with the agent ID and at least a 'components' field.
 * Settings files should be in JSON format and contain an 'id' field with the agent ID and the settings in a 'settings' field.
 *     'settings' field is a key-value object with the Agent settings.
 */
export class LocalAgentDataConnector extends AgentDataConnector {
    public name: string = 'LocalAgentDataConnector';
    private devDir;
    private prodDir;
    private agentsData = { dev: {}, prod: {} };
    private agentSettings = { dev: {}, prod: {} };

    constructor(settings: LocalAgentDataSettings) {
        super();
        this.devDir = settings.devDir;
        this.prodDir = settings.prodDir;
    }

    public getAgentConfig(agentId: string): Partial<LocalAgentDataSettings> {
        return {};
    }

    private indexDir(dir: string) {
        const agents = fs.readdirSync(dir);

        const agentsData = {};
        const agentSettings = {};
        for (const agent of agents) {
            if (!agent.endsWith('.smyth')) continue;

            const agentData = fs.readFileSync(path.join(dir, agent), 'utf8');
            let jsonData;
            try {
                jsonData = JSON.parse(agentData);

                if (!jsonData.components) {
                    console.warn(`File ${agent} is not a valid agent data file, skipping...`);
                    continue;
                }

                if (!jsonData.id) {
                    console.warn(`Agent data for ${agent} does not contain an id, generating one...`);
                    jsonData.id = 'tmp-' + uid();
                }
            } catch (e) {
                console.warn(`Error parsing agent data for ${agent}: ${e.message}`);
            }

            //is this an agent data file?
            if (jsonData.components) agentsData[jsonData.id] = jsonData;

            //does this file contain settings?
            if (jsonData.settings) agentSettings[jsonData.id] = jsonData.settings;
        }

        return { agentsData, agentSettings };
    }
    private indexAgentsData() {
        const { agentsData: devAgentsData, agentSettings: devAgentSettings } = this.indexDir(this.devDir);
        const { agentsData: prodAgentsData, agentSettings: prodAgentSettings } = this.indexDir(this.prodDir);
        this.agentsData = { dev: devAgentsData, prod: prodAgentsData };
        this.agentSettings = { dev: devAgentSettings, prod: prodAgentSettings };
    }

    public async start() {
        super.start();
        this.started = false;
        this.indexAgentsData();
        this.started = true;
    }

    /**
     * returns the agent data for the provided agent ID
     * if the version is not provided, it defaults to the dev version
     * otherwise it loads the corresponding prod version
     * @param agentId
     * @param version
     * @returns
     */
    public async getAgentData(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }

        const data = version ? this.agentsData.prod[agentId] : this.agentsData.dev[agentId];

        if (data) {
            return { data, version: version || '1.0' };
        } else {
            throw new Error(`Agent with id ${agentId} not found`);
        }
    }

    public getAgentIdByDomain(domain: string): Promise<string> {
        return Promise.resolve('');
    }

    /**
     * returns the agent settings for the provided agent ID
     * if the version is not provided, it defaults to the dev version
     * otherwise it loads the corresponding prod version
     * @param agentId
     * @param version
     * @returns
     */
    public async getAgentSettings(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }

        const settings = version ? this.agentSettings.prod[agentId] : this.agentSettings.dev[agentId];

        if (settings) {
            return settings;
        } else {
            throw new Error(`Settings for agent with id ${agentId} not found`);
        }
    }

    public async getAgentEmbodiments(agentId: string): Promise<any> {
        return [];
    }

    public async listTeamAgents(teamId: string, deployedOnly?: boolean): Promise<any[]> {
        console.warn(`listTeamAgents is not implemented for LocalAgentDataConnector`);
        return [];
    }

    public async isDeployed(agentId: string): Promise<boolean> {
        return !!this.agentsData.prod[agentId];
    }
}
