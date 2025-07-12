import { ConnectorService, TConnectorService, GitConnector } from '@smythos/sre';
import { SDKObject } from '../Core/SDKObject.class';

export class GitInstance extends SDKObject {
    private connector: GitConnector;

    constructor(private settings: any = {}) {
        super();
    }

    protected async init() {
        await super.init();
        let git = ConnectorService.getGitConnector();
        if (!git?.valid) {
            git = ConnectorService.init(TConnectorService.Git, 'Git', 'Git', {});
        }
        this.connector = git.instance(this.settings);
    }

    async clone(repo: string, path: string) {
        await this.ready;
        await this.connector.clone(repo, path);
    }

    async diff(repoPath: string, options?: string) {
        await this.ready;
        return await this.connector.diff(repoPath, options);
    }

    async commit(repoPath: string, message: string) {
        await this.ready;
        await this.connector.commit(repoPath, message);
    }
}
