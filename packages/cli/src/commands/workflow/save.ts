import { Args, Command } from '@oclif/core';
import { Agent } from '@smythos/sdk';
import fs from 'fs';

function saveWorkflow(agent: Agent, file: string) {
    fs.writeFileSync(file, JSON.stringify(agent.export(), null, 2));
}

export default class WorkflowSave extends Command {
    static override description = 'Save an agent workflow to a file';

    static override args = {
        agent: Args.string({ description: 'Agent .smyth file', required: true }),
        file: Args.string({ description: 'Destination file', required: true }),
    } as const;

    async run(): Promise<void> {
        const { args } = await this.parse(WorkflowSave);
        const agent = Agent.import(args.agent);
        saveWorkflow(agent, args.file);
        this.log(`Workflow saved to ${args.file}`);
    }
}
