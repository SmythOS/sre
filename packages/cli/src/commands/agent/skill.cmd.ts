import { Agent } from '@smythos/sdk';
import util from 'util';

export default async function runSkill(args: any, flags: any) {
    const agentPath = args.path;

    //Importing the agent workflow
    const agent = Agent.import(agentPath);

    const result = await agent.call(flags.skill, flags.input);
    console.log(util.inspect(result, { showHidden: true, depth: null, colors: true }));
}
