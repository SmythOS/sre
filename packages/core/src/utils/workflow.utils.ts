import fs from 'fs';
import { Agent } from '../../../sdk/src/Agent/Agent.class';

export function saveWorkflow(agent: Agent, file: string) {
    const data = agent.export();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

export function loadWorkflow(path: string): Agent {
    const data = fs.readFileSync(path, 'utf8');
    return Agent.import(JSON.parse(data));
}
