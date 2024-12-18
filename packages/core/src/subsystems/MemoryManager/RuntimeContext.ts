import EventEmitter from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import config from '@sre/config';
import { delay, uid } from '@sre/utils';
import AgentRuntime from '@sre/AgentManager/AgentRuntime.class';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('RuntimeContext');

type TRuntimeData = {
    input?: { [key: string]: any };
    _LoopData?: any;
    _ChildLoopData?: any;
};
type TComponentContext = {
    active: boolean;
    name: string;
    runtimeData?: TRuntimeData;
    step: number;
    input?: { [key: string]: any };
    output?: { [key: string]: any };
};
export class RuntimeContext extends EventEmitter {
    public circularLimitReached: string | boolean = false;
    public step: number = 0;
    public sessionResult: boolean = false;
    public sessionResults: any;
    public components: { [id: string]: { ctx: TComponentContext } } = {};

    public checkRuntimeContext: any = null;

    private ctxFile: string = '';
    private _runtimeFileReady: any;

    constructor(private runtime: AgentRuntime) {
        super();
        const agent = runtime.agent;
        const dbgFolder = path.join(<string>config.env.DATA_PATH || path.join(os.tmpdir(), '.smyth') , `/debug/${agent.id}/`);
        
        if (!fs.existsSync(dbgFolder)) {
            fs.mkdirSync(dbgFolder, { recursive: true });
        }

        const processRootID = runtime.processID?.split(':')[0] || '';
        const reqId = processRootID == runtime.xDebugId ? '' : '.' + uid() + runtime.reqTag;
        this.ctxFile = path.join(dbgFolder, `${runtime.xDebugId}${reqId}${agent.jobID ? `-job-${agent.jobID}` : ''}.json`);

        this.initRuntimeContext();
    }

    private serialize() {
        const data = {
            step: this.step,
            sessionResult: this.sessionResult,
            sessionResults: this.sessionResults,
            components: this.components,
        };

        return data;
    }
    private deserialize(data: any) {
        this.step = data.step;
        this.sessionResult = data.sessionResult;
        this.sessionResults = data.sessionResults;
        this.components = data.components;
    }
    private reset() {
        this.step = 0;
        this.sessionResult = false;
        this.sessionResults = null;
        this.components = {};
    }

    private initRuntimeContext() {
        if (this._runtimeFileReady) return;

        const endpointDBGCall = this.runtime.xDebugId?.startsWith('dbg-'); //weak check for debug session, we need to improve this
        console.debug('Init ctxFile', this.ctxFile);
        const agent = this.runtime.agent;
        let method = (agent.agentRequest.method || 'POST').toUpperCase();
        const endpoint = agent.endpoints?.[agent.agentRequest.path]?.[method];

        let ctxData: any = {};
        if (!fs.existsSync(this.ctxFile)) {
            ctxData = JSON.parse(JSON.stringify({ components: agent.components, connections: agent.connections, timestamp: Date.now() }));
            if (!ctxData.step) ctxData.step = 0;
            for (let cptId in ctxData.components) {
                ctxData.components[cptId] = {
                    id: cptId,
                    name: ctxData.components[cptId].name,
                    //dbg: { active: false, name: ctxData.components[cptId].name },
                    ctx: { active: false, name: ctxData.components[cptId].name },
                };

                const cpt = ctxData.components[cptId];
                //if this debug session was initiated from an endpoint, we mark the endpoint component as active
                if (endpoint && endpoint.id != undefined && cpt.id == endpoint.id && endpointDBGCall) {
                    //cpt.dbg.active = true;
                    cpt.ctx.active = true;
                }
            }
            fs.writeFileSync(this.ctxFile, JSON.stringify(ctxData, null, 2));
        } else {
            ctxData = JSON.parse(fs.readFileSync(this.ctxFile, 'utf8'));
            if (!ctxData.step) ctxData.step = 0;
        }

        this.deserialize(ctxData);
        this._runtimeFileReady = true;
        this.emit('ready');
    }
    public async sync() {
        if (!this.ctxFile) return;
        this.emit('syncing');

        const deleteSession = this.runtime.sessionClosed;

        if (deleteSession) {
            if (this.runtime.debug && fs.existsSync(this.ctxFile)) await delay(1000 * 60); //if we're in debug mode, we keep the file for a while to allow final state read
            if (fs.existsSync(this.ctxFile)) fs.unlinkSync(this.ctxFile);
        } else {
            const data = this.serialize();
            if (data) fs.writeFileSync(this.ctxFile, JSON.stringify(data, null, 2));
        }
    }

    public incStep() {
        this.step++;
        this.sync();
    }

    public updateComponent(componentId: string, data: any) {
        const ctxData = this;
        if (!ctxData) return;
        const component = ctxData.components[componentId];

        if (!component) {
            console.log('>>>>>>> updateComponent Component debug data not found', componentId, component);
            console.log('>>> ctxFile', this.ctxFile);
            console.log('>>> ctxData', ctxData);
        }
        component.ctx = { ...component.ctx, ...data, step: this.step };

        //if (this.debug) component.dbg = { ...component.dbg, ...data };

        this.sync();
    }
    public resetComponent(componentId: string) {
        const ctxData = this;
        const component = ctxData.components[componentId];
        if (!component) {
            console.log('>>>>>>> resetComponent Component debug data not found', componentId, component);
            console.log('>>> ctxFile', this.ctxFile);
            console.log('>>> ctxData', ctxData);
        }
        //component.dbg.active = false;
        //component.dbg.runtimeData = {};
        component.ctx.runtimeData = {};
        component.ctx.active = false;

        this.sync();
    }

    public getComponentData(componentId: string) {
        const ctxData = this;
        if (!ctxData) return null;
        const component = ctxData.components[componentId];
        if (!component) {
            console.log('>>>>>>> getComponentData Component debug data not found', componentId, component);
            console.log('>>> ctxFile', this.ctxFile);
            console.log('>>> ctxData', ctxData);
        }
        //const data = this.debug ? component.dbg : component.ctx;
        const data = component.ctx;

        return data;
    }
}
