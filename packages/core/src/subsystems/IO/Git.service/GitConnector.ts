import { Connector } from '@sre/Core/Connector.class';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface IGitRequest {
    clone(repo: string, path: string): Promise<void>;
    diff(repoPath: string, options?: string): Promise<string>;
    commit(repoPath: string, message: string): Promise<void>;
}

export class GitConnector extends Connector {
    public name = 'Git';

    public async clone(repo: string, path: string) {
        await execAsync(`git clone ${repo} ${path}`);
    }

    public async diff(repoPath: string, options = '') {
        const { stdout } = await execAsync(`git -C ${repoPath} diff ${options}`);
        return stdout;
    }

    public async commit(repoPath: string, message: string) {
        await execAsync(`git -C ${repoPath} add .`);
        await execAsync(`git -C ${repoPath} commit -m "${message.replace(/"/g, '\\"')}"`);
    }

    public requester(): IGitRequest {
        return {
            clone: this.clone.bind(this),
            diff: this.diff.bind(this),
            commit: this.commit.bind(this),
        };
    }
}
