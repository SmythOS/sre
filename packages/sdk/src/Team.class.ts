import { Agent, TAgentSettings } from './Agent.class';

export class Team {
    constructor(public id: string) {}
    public agent(settings: TAgentSettings) {
        settings.teamId = this.id;
        return new Agent(settings);
    }
}
