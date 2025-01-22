import Agent from './Agent.class';

//this class handles Agent Server Sent Events
export class AgentSSE {
    constructor(private agent: Agent, private res?: any) {}

    public updateRes(res: any) {
        this.res = res;
    }

    public send(_type: string, data: any) {
        if (!this.res || !_type || !data) return;
        this.res.write(`event: ${_type}\n`);
        this.res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
    }
}

export default AgentSSE;
