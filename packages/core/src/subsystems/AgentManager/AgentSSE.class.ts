import Agent from './Agent.class';

//this class handles Agent Server Sent Events
export class AgentSSE {
    constructor(private agent: Agent, public res?: any) {}

    public updateRes(res: any) {
        this.res = res;
    }

    public async send(_type: string, _data: any) {
        if (!this.res || !_type || !_data) return;
        this.res.write(`event: ${_type}\n`);
        const data = typeof _data === 'string' ? _data : JSON.stringify(_data);
        this.res.write(`data: ${data}\n\n`);
    }

    public async close() {
        if (this.res) this.res.end();
    }
}

export default AgentSSE;
