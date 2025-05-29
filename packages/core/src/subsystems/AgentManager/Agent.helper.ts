export function isAgent(agent: any): boolean {
    return typeof agent === 'object' && agent.id && typeof agent.callComponent === 'function';
}
