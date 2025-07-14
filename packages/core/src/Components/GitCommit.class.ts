import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import Joi from 'joi';
import { Git } from '@smythos/sdk';

export class GitCommit extends Component {
    protected configSchema = Joi.object({
        repoPath: Joi.string().required().label('Repository Path'),
        message: Joi.string().required().label('Commit Message'),
    });

    constructor() {
        super();
    }
    init() {}

    async process(input: any, config: any, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const repoPath = config.data.repoPath;
            const message = config.data.message;
            const git = Git.instance();
            await git.commit(repoPath, message);
            return { Success: true, _error: undefined, _debug: logger.output };
        } catch (err: any) {
            logger.error('Git commit failed', err?.message || err.toString());
            return { Success: false, _error: err?.message || err.toString(), _debug: logger.output };
        }
    }
}
