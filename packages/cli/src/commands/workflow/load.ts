import { Args, Command } from '@oclif/core';
import { loadWorkflow } from '@smythos/sre/utils';

export default class WorkflowLoad extends Command {
    static override description = 'Load a workflow from file';

    static override args = {
        file: Args.string({ description: 'Workflow file', required: true }),
    } as const;

    async run(): Promise<void> {
        const { args } = await this.parse(WorkflowLoad);
        const agent = loadWorkflow(args.file);
        this.log(`Loaded workflow for agent ${agent.data.name || agent.data.id}`);
    }
}
