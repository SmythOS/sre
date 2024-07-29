export default class AgentRequest {
    public headers: any;
    public body: any;
    public query: any;
    public params: any;
    public method: string = 'GET';
    public path: string = '';
    public sessionID: string = '';
    public res: Response | null = null;
    public req: Request | null = null;
    public files: any[] = [];
    public _agent_authinfo: any;
    constructor(req?: AgentRequest | string[] | any) {
        if (!req) return;
        this.headers = JSON.parse(JSON.stringify(req.headers || {}));
        this.body = JSON.parse(JSON.stringify(req.body || req.data || {}));
        this.query = JSON.parse(JSON.stringify(req.query || {}));
        this.params = JSON.parse(JSON.stringify(req.params || {}));

        if (req.url) {
            const parsedUrl = new URL(req.url || '');
            this.path = parsedUrl.pathname;
        }
        if (req.path) this.path = req.path;

        this.method = req.method;

        this.sessionID = req.sessionID;
        this.files = req.files || [];
        this._agent_authinfo = req._agent_authinfo;

        this.req = req instanceof AgentRequest ? req?.req : req;
        this.res = req?.res || null;
    }
    header(name: string) {
        return this.headers[name.toLowerCase()];
    }
}
