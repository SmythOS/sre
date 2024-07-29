// import Component from './Component.class';
import Joi from 'joi';
// import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { validateInteger } from '../utils';
import { jsonrepair } from 'jsonrepair';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
// import { LLMHelper } from '@sre/LLMManager/LLM.helper';

class LLMHelper {
    static load(model: string) {
        throw new Error('Method not implemented.');
    }
}

export default class DataSourceLookup extends Component {
    protected configSchema = Joi.object({
        topK: Joi.string()
            .custom(validateInteger({ min: 0 }), 'custom range validation')
            .label('Result Count'),
        model: Joi.string().valid('gpt-3.5-turbo', 'gpt-4', 'gpt-3.5-turbo-16k').required(),
        prompt: Joi.string().max(30000).allow('').label('Prompt'),
        postprocess: Joi.boolean().strict().required(),
        includeMetadata: Joi.boolean().strict().optional(),
        namespace: Joi.string().allow('').max(80).messages({
            // Need to reserve 30 characters for the prefixed unique id
            'string.max': `The length of the 'namespace' name must be 50 characters or fewer.`,
        }),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const componentId = config.id;
        const component = agent.components[componentId];
        const teamId = agent.teamId;

        const outputs = {};
        for (let con of config.outputs) {
            if (con.default) continue;
            outputs[con.name] = '';
        }

        const namespace = config.data.namespace;
        const model = config.data.model;
        const prompt = config.data.prompt?.trim?.() || '';
        const postprocess = config.data.postprocess;
        const includeMetadata = config.data.includeMetadata || false;

        const _input = typeof input.Query === 'string' ? input.Query : JSON.stringify(input.Query);

        const topK = Math.max(config.data.topK, 50);

        const vectorDB = ConnectorService.getVectorDBConnector();

        let results: string[] | { content: string; metadata: any }[];
        let _error;
        try {
            const response = await vectorDB.user(AccessCandidate.team(teamId)).search(namespace, _input, { topK, includeMetadata: true });
            results = response.slice(0, config.data.topK).map((result) => ({
                content: result.metadata?.text,
                metadata: result.metadata,
            }));

            if (includeMetadata) {
                // only show user-level metadata
                results = results.map((result) => ({
                    content: result.content,
                    metadata: this.parseMetadata(
                        result.metadata?.user || result.metadata?.metadata //* legacy user-specific metadata key [result.metadata?.metadata]
                    ),
                }));
            } else {
                results = results.map((result) => result.content);
            }
        } catch (error) {
            _error = error.toString();
        }

        //is there a post processing LLM?

        //TODO : better handling of context window exceeding max length
        if (postprocess && prompt) {
            const promises: any = [];
            for (let result of results) {
                const _prompt = TemplateString(prompt.replace(/{{result}}/g, JSON.stringify(result))).parse(input).result;
                // promises.push(LLMHelper.componentLLMRequest(_prompt, model, {}, agent).catch((error) => result));
                const llmHelper = LLMHelper.load(model);
                // const req = llmHelper.promptRequest(_prompt, config, agent).catch((error) => ({ error: error }));
                // promises.push(req);
            }
            results = await Promise.all(promises);
            for (let i = 0; i < results.length; i++) {
                if (typeof results[i] === 'string') {
                    // results[i] = parseJson(results[i]);
                    results[i] = JSONContent(results[i] as string).tryParse();
                }
            }
        }

        const totalLength = JSON.stringify(results).length;
        return {
            Results: results,
            _error,
            _debug: `totalLength = ${totalLength}`,
            //_debug: `Query: ${_input}. \nTotal Length = ${totalLength} \nResults: ${JSON.stringify(results)}`,
        };
    }

    // private async checkIfTeamOwnsNamespace(teamId: string, namespaceId: string, token: string) {
    //     try {
    //         const res = await SmythAPIHelper.fromAuth({ token }).mwSysAPI.get(`/vectors/namespaces/${namespaceId}`);
    //         if (res.data?.namespace?.teamId !== teamId) {
    //             throw new Error(`Namespace does not exist`);
    //         }
    //         return true;
    //     } catch (err) {
    //         throw new Error(`Namespace does not exist`);
    //     }
    // }

    private parseMetadata(metadata: any) {
        try {
            return JSON.parse(jsonrepair(metadata));
        } catch (err) {
            return metadata;
        }
    }
}
