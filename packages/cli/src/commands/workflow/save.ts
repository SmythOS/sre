import { Args, Command } from '@oclif/core';
import { Agent } from '@smythos/sdk';
import { saveWorkflow } from '@smythos/sre/utils';

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
