import { Agent } from '../Agent/Agent.class';
export declare class ComponentWrapper {
    private _internalData;
    private _agentMaker?;
    private _id;
    outputPathRewrite: (path: string) => string;
    get internalData(): any;
    get id(): string;
    get agentMaker(): Agent;
    set agentMaker(agentMaker: Agent);
    get data(): {
        name: any;
        data: any;
        displayName: any;
        title: any;
        id: string;
        process: any;
        left: string;
        top: string;
        inputs: any[];
        outputs: any[];
    };
    private get _name();
    private get _settings();
    private get _inputs();
    private get _outputs();
    constructor(_internalData: any, _agentMaker?: Agent);
    inputs<T extends Record<string, any>>(inputsList: T): this;
    private extractArgsInputs;
}
