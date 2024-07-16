import { parseCLIArgs } from '@sre/utils/cli.utils';
import fs from 'fs';
import path from 'path';
import { AgentDataConnector } from '../AgentDataConnector';

type TArgs = { args: Record<string, any> };
export class CLIAgentDataConnector extends AgentDataConnector {
    public name: string = 'CLIAgentDataConnector';
    private argv;
    constructor(settings: TArgs) {
        super();
        this.argv = settings.args || process.argv;
    }
    public async getAgentData(agentId: string, version?: string) {
        const params: any = parseCLIArgs('agent', this.argv);

        //get current directory
        const __dirname = fs.realpathSync(process.cwd());
        const filePath = path.join(__dirname, params.agent);

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');

            return { data: JSON.parse(data), version: version || '1.0' };
        }
    }

    public getAgentIdByDomain(domain: string): Promise<string> {
        return Promise.resolve('');
    }
    public async getAgentSettings(agentId: string, version?: string) {
        const params: any = parseCLIArgs('settings', this.argv);
        let settings: any;

        if (typeof params.settings === 'string') {
            if (fs.existsSync(params.settings)) {
                settings = JSON.parse(fs.readFileSync(params.settings, 'utf8'));
            }
        } else {
            settings = params.settings;
        }
        return settings;
    }
}
