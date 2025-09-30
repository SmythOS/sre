import EventEmitter from 'events';
import { delay, uid } from '@sre/utils';
import { AgentRuntime } from '@sre/AgentManager/AgentRuntime.class';
import { Logger } from '@sre/helpers/Log.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { CacheConnector } from './Cache.service/CacheConnector';

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
    private _cacheConnector: CacheConnector;

    private _readyPromise: Promise<boolean>;
    private _lastCtxLength: number = 0;

    constructor(private runtime: AgentRuntime) {
        super();
        const agent = runtime.agent;

        this._cacheConnector = ConnectorService.getCacheConnector();

        const processRootID = runtime.processID?.split(':')[0] || '';
        const reqId = processRootID == runtime.xDebugId ? '' : '.' + uid() + runtime.reqTag;

        this.ctxFile = `${runtime.xDebugId}${reqId}${agent.jobID ? `-job-${agent.jobID}` : ''}`;

        this._readyPromise = new Promise((resolve, reject) => {
            let resolved = false;
            this.on('ready', () => {
                resolved = true;
                resolve(true);
            });
            const timer = setTimeout(() => {
                if (!resolved) {
                    reject(new Error('Agent Runtime context initialization timeout'));
                }
            }, 5 * 60 * 1000);
            timer.unref(); //unblock the event loop
        });

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
        console.debug('Init Agent Context', this.ctxFile, AccessCandidate.agent(this.runtime.agent.id));
        const agent = this.runtime.agent;
        let method = (agent.agentRequest.method || 'POST').toUpperCase();
        const endpoint = agent.endpoints?.[agent.agentRequest.path]?.[method];

        let ctxData: any = {};

        this._cacheConnector
            .requester(AccessCandidate.agent(this.runtime.agent.id))
            .get(this.ctxFile)
            .then(async (data) => {
                if (!data) {
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

                    await this._cacheConnector
                        .requester(AccessCandidate.agent(this.runtime.agent.id))
                        .set(this.ctxFile, JSON.stringify(ctxData), null, null, 1 * 60 * 60); //expires in 1 hour
                } else {
                    ctxData = JSON.parse(data);
                    if (!ctxData.step) ctxData.step = 0;
                }

                this.deserialize(ctxData);
                this._runtimeFileReady = true;
                this.emit('ready');
            });
    }

    public async ready() {
        if (this._runtimeFileReady) return true;
        return this._readyPromise;
    }
    private async sync() {
        if (!this.ctxFile) return;

        this.emit('syncing');

        const deleteSession = this.runtime.sessionClosed;

        //TODO : Do we need to cache the context if not in debug mode ?

        const data = this.serialize();
        //if (data) fs.writeFileSync(this.ctxFile, JSON.stringify(data, null, 2));
        if (data) {
            let serializedData = JSON.stringify(data);

            if (serializedData.length != this._lastCtxLength) {
                //only log if context has changes
                //We use the length as a weak but fast way to detect changes
                console.debug('Agent Context Size', this.ctxFile, serializedData.length, AccessCandidate.agent(this.runtime.agent.id));
                this._lastCtxLength = serializedData.length;
            }

            await this._cacheConnector
                .requester(AccessCandidate.agent(this.runtime.agent.id))
                .set(this.ctxFile, serializedData, null, null, 3 * 60 * 60); //expires in 3 hours max

            const mb = serializedData.length / 1024 / 1024;
            const cooldown = (mb / 10) * 1000;
            serializedData = null;

            await delay(cooldown);
        }

        if (deleteSession) {
            const exists = await this._cacheConnector.requester(AccessCandidate.agent(this.runtime.agent.id)).exists(this.ctxFile);

            if (exists) {
                console.debug('Agent Context Delete', this.ctxFile, AccessCandidate.agent(this.runtime.agent.id));
                if (this.runtime.debug) this._cacheConnector.requester(AccessCandidate.agent(this.runtime.agent.id)).updateTTL(this.ctxFile, 5 * 60);
                //expires in 5 minute
                else this._cacheConnector.requester(AccessCandidate.agent(this.runtime.agent.id)).delete(this.ctxFile);
                //if (this.runtime.debug && fs.existsSync(this.ctxFile)) await delay(1000 * 60); //if we're in debug mode, we keep the file for a while to allow final state read
                //if (fs.existsSync(this.ctxFile)) fs.unlinkSync(this.ctxFile);
                this.ctxFile = null;
            }
        }
    }
    private _syncQueue = Promise.resolve();

    public enqueueSync() {
        if (!this.ctxFile) return;

        this._syncQueue = this._syncQueue
            .then(() => this.sync())
            .catch((err) => {
                console.error('Error syncing context', err);
            }); // avoid unhandled rejections
    }
    public incStep() {
        this.step++;
        //this.sync();
    }

    public updateComponent(componentId: string, data: any) {
        const ctxData = this;
        if (!ctxData) return;
        const component = ctxData.components[componentId];

        if (!component) {
            console.debug(
                '>>>>>>> updateComponent Component debug data not found',
                componentId,
                component,
                AccessCandidate.agent(this.runtime.agent.id)
            );
            console.debug('>>> ctxFile', this.ctxFile, AccessCandidate.agent(this.runtime.agent.id));
            console.debug('>>> ctxData', ctxData, AccessCandidate.agent(this.runtime.agent.id));
        }
        //component.ctx = { ...component.ctx, ...data, step: this.step };
        // minimal allocations

        if (!component.ctx) component.ctx = { active: false, name: '', step: 0 };
        Object.assign(component.ctx, data);
        component.ctx.step = this.step;

        //if (this.debug) component.dbg = { ...component.dbg, ...data };

        this.enqueueSync();
    }
    public resetComponent(componentId: string) {
        const ctxData = this;
        const component = ctxData.components[componentId];
        if (!component) {
            console.debug(
                '>>>>>>> resetComponent Component debug data not found',
                componentId,
                component,
                AccessCandidate.agent(this.runtime.agent.id)
            );
            console.debug('>>> ctxFile', this.ctxFile, AccessCandidate.agent(this.runtime.agent.id));
            console.debug('>>> ctxData', ctxData, AccessCandidate.agent(this.runtime.agent.id));
        }
        //component.dbg.active = false;
        //component.dbg.runtimeData = {};
        component.ctx.runtimeData = {};
        component.ctx.active = false;
        if (!this.runtime.debug) {
            //console.debug('NOT in debug mode, clearing context input/output');
            component.ctx.input = undefined;
            component.ctx.output = undefined;
        }

        this.enqueueSync();
    }

    public getComponentData(componentId: string) {
        const ctxData = this;
        if (!ctxData) return null;
        const component = ctxData.components[componentId];
        if (!component) {
            console.debug(
                '>>>>>>> getComponentData Component debug data not found',
                componentId,
                component,
                AccessCandidate.agent(this.runtime.agent.id)
            );
            console.debug('>>> ctxFile', this.ctxFile, AccessCandidate.agent(this.runtime.agent.id));
            console.debug('>>> ctxData', ctxData, AccessCandidate.agent(this.runtime.agent.id));
        }
        //const data = this.debug ? component.dbg : component.ctx;
        const data = component.ctx;

        return data;
    }
}
