import { Args, Command } from '@oclif/core';
import { Agent } from '@smythos/sdk';
function loadWorkflow(filePath: string): Agent {
    const data = fs.readFileSync(filePath, 'utf8');
    return Agent.import(JSON.parse(data));
}
import fs from 'fs';
import path from 'path';

export default class WorkflowLoad extends Command {
    static override description = 'Load a workflow from file or template';

    static override args = {
        source: Args.string({ description: 'Workflow file or template name', required: true }),
    } as const;

    async run(): Promise<void> {
        const { args } = await this.parse(WorkflowLoad);
        let workflowPath = args.source;

        if (!fs.existsSync(workflowPath)) {
            const templatePath = path.join(__dirname, '../../..', 'templates', `${args.source}.smyth`);
            if (fs.existsSync(templatePath)) {
                workflowPath = templatePath;
            } else {
                this.error(`File or template ${args.source} not found`);
                return;
            }
        }

        const agent = loadWorkflow(workflowPath);
        this.log(`Loaded workflow for agent ${agent.data.name || agent.data.id}`);
    }
}
