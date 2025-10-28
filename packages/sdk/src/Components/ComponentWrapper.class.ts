import { uid } from '../utils/general.utils';
import { createSafeAccessor } from './utils';
import { Agent } from '../Agent/Agent.class';
import { InputSettings } from '../types/SDKTypes';
import * as acorn from 'acorn';

export class ComponentWrapper {
    private _id: string;

    public outputPathRewrite: (path: string) => string = (path) => path;

    public get internalData() {
        return this._internalData;
    }

    public get id() {
        return this._id;
    }
    public get agentMaker() {
        return this._agentMaker;
    }
    public set agentMaker(agentMaker: Agent) {
        this._agentMaker = agentMaker;
    }

    public get data() {
        const processInputs = this._internalData.process ? this.extractArgsInputs(this._internalData.process) : [];
        const data = {
            name: this._name,
            data: this._settings,
            displayName: this._name,
            title: this._name,
            id: this._id,
            process: typeof this._internalData.process === 'function' ? this._internalData.process : undefined,
            left: '0px',
            top: '0px',
            inputs: [
                ...processInputs,
                ...Object.keys(this._inputs || {}).map((key) => ({
                    name: key,
                    type: this._inputs[key].type || 'Any',
                    description: this._inputs[key].description || undefined,
                    optional: this._inputs[key].optional || false,
                    default: this._inputs[key].default || undefined,
                    //value: this._inputs[key],
                })),
            ],
            outputs: Object.keys(this._outputs || {}).map((key) => ({
                name: key,
                ...(this._outputs?.[key]?.['__props__'] || {}),
            })),
        };

        //merge inputs having the same name
        const inputs = data.inputs.reduce((acc, input) => {
            if (acc[input.name]) {
                acc[input.name] = { ...acc[input.name], ...input };
            } else {
                acc[input.name] = input;
            }
            return acc;
        }, {});
        data.inputs = Object.values(inputs);

        return data;
    }
    private get _name() {
        return this._internalData.name;
    }
    private get _settings() {
        return this._internalData.settings;
    }
    private get _inputs(): Record<string, { source: any; component: ComponentWrapper } & InputSettings> {
        return this._internalData.inputs;
    }
    private get _outputs() {
        return this._internalData.outputs;
    }

    constructor(private _internalData: any, private _agentMaker?: Agent) {
        this._id = 'C' + uid();
    }

    public inputs<T extends Record<string, any>>(inputsList: T) {
        for (let key in inputsList) {
            // if (this._inputs[key]) {
            //     console.warn(`Input ${key} already exists, overriding`);
            // }

            const val = inputsList[key];

            //console.log('__root__', val?.__root__);
            //console.log('__path__', val?.__path__);

            const sourceData = val?.['__root__']?.data;
            let outputPath = val?.['__path__'];
            const agentMaker = val?.['__root__']?.agentMaker;

            //console.log('Connecting input', key, 'to', rootData?.id, path);

            if (agentMaker) {
                if (!this.agentMaker) {
                    this.agentMaker = agentMaker;
                }
                const found = agentMaker?.structure?.components.find((c) => c.id == this._id);
                if (!found) {
                    agentMaker?.structure?.components?.push(this);
                }

                const sourceId = sourceData?.id;
                const targetId = this._id;

                if (sourceId && targetId) {
                    const sourceComponent = agentMaker?.structure?.components?.find((c) => c.id == sourceId);
                    outputPath = sourceComponent.outputPathRewrite(outputPath);
                    //const sourceOutput = sourceComponent?._outputs[outputPath];
                    const sourceOutputKeys = Object.keys(sourceComponent?._outputs);

                    if (!sourceOutputKeys.includes(outputPath)) {
                        sourceComponent._outputs[outputPath] = createSafeAccessor({}, sourceComponent, outputPath);
                    }
                    const connection = {
                        sourceId,
                        targetId,
                        sourceIndex: outputPath,
                        targetIndex: key,
                    };
                    agentMaker?.structure?.connections?.push(connection);
                }
            }

            //console.log('connection', connection);

            if (typeof sourceData !== 'undefined') {
                (inputsList as any)[key] = {
                    source: val,
                };
                const targetInput = this._inputs[key];
                if (!targetInput) {
                    this._inputs[key] = {
                        source: val,
                        component: this,
                        type: 'Any',
                        default: false,
                    };
                }
            } else {
                //TODO : handle json input mapping
                //eg component.in({param : {source: 'body.param', description: 'The parameter description' ...}})

                const targetInput = this._inputs[key];
                if (!targetInput) {
                    this._inputs[key] = {
                        component: this,
                        type: 'Any',
                        default: false,
                        ...val,
                    } as any;
                }
            }
            //console.log('input', key, rootData);

            //this.dataObject.connections.push(connection);
        }
        return this;
    }

    private extractArgsInputs(fn) {
        const ast = acorn.parse(`(${fn.toString()})`, { ecmaVersion: 'latest' });
        const params = (ast.body[0] as any).expression.params;

        let counter = 0;
        function handleParam(param) {
            if (param.type === 'Identifier') {
                return [
                    {
                        name: param.name,
                        type: 'Any',
                        description: '',
                    },
                ];
            }

            if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
                return [
                    {
                        name: param.left.name,
                        type: 'Any',
                        description: '',
                    },
                ];
            }

            if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
                return [
                    {
                        name: param.argument.name,
                        type: 'Any',
                        description: '',
                    },
                ];
            }

            if (param.type === 'ObjectPattern') {
                // For destructured objects, output as a single parameter with nested fields
                const name = `[object_${counter++}]`;

                const properties = param.properties.map((prop) => {
                    const keyName = prop.key.name || `unknown_${counter++}`;
                    return {
                        name: keyName,
                        type: 'Any',
                        description: '',
                    };
                });
                return properties;
            }

            const name = `unknown_${counter++}`;
            return {
                name,
                type: 'Any',
                description: '',
            };
        }

        return params.map(handleParam).flat();
    }
}
