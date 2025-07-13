import fs from 'fs';
import { Agent } from '../../../sdk/src/Agent/Agent.class';

export function saveWorkflow(agent: Agent, file: string) {
    fs.writeFileSync(file, JSON.stringify(agent.export(), null, 2));
}

export function loadWorkflow(path: string): Agent {
    const data = fs.readFileSync(path, 'utf8');
    return Agent.import(JSON.parse(data));
}
