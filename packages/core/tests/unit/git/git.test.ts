import { Git } from '@smythos/sdk';
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execSync } from 'child_process';

function tempDir(prefix: string) {
    return mkdtempSync(path.join(tmpdir(), prefix));
}

describe('Git Connector', () => {
    it('clone modify commit cycle', async () => {
        const repoSrc = tempDir('repo-src-');
        execSync('git init', { cwd: repoSrc });
        fs.writeFileSync(path.join(repoSrc, 'file.txt'), 'hello');
        execSync('git add .', { cwd: repoSrc });
        execSync('git commit -m "init"', { cwd: repoSrc });

        const cloneDir = tempDir('repo-clone-');
        const git = Git.instance();
        await git.clone(repoSrc, cloneDir);

        const filePath = path.join(cloneDir, 'file.txt');
        fs.appendFileSync(filePath, ' world');

        const diff = await git.diff(cloneDir);
        expect(diff).toContain('world');

        await git.commit(cloneDir, 'update');

        const log = execSync('git log -1 --pretty=%B', { cwd: cloneDir }).toString().trim();
        expect(log).toBe('update');
    });
});
