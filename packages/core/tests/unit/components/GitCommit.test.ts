import { describe, it, expect } from 'vitest';
import { GitCommit } from '../../../src/Components/GitCommit.class';
import fs from 'fs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execSync } from 'child_process';

function tempDir(prefix: string) {
    return mkdtempSync(path.join(tmpdir(), prefix));
}

const agent: any = { id: 'agent', teamId: 'team', agentRuntime: { debug: false }, isKilled: () => false };

describe('GitCommit Component', () => {
    it('commits changes in a repository', async () => {
        const repoDir = tempDir('gitcommit-');
        execSync('git init', { cwd: repoDir });
        fs.writeFileSync(path.join(repoDir, 'file.txt'), 'hello');
        execSync('git add .', { cwd: repoDir });
        execSync('git commit -m "init"', { cwd: repoDir });

        fs.appendFileSync(path.join(repoDir, 'file.txt'), ' world');

        const gitCommit = new GitCommit();
        const config = { data: { repoPath: repoDir, message: 'update' }, id: '1' } as any;
        const res = await gitCommit.process({}, config, agent);
        expect(res._error).toBeUndefined();

        const log = execSync('git -C ' + repoDir + ' log -1 --pretty=%B').toString().trim();
        expect(log).toBe('update');
    });
});
