import { describe, expect, it } from 'vitest';
import { JobQueue, JobQueueItem } from '../../../src/subsystems/JobQueue.service';

function createProcessor(results: string[], delayMs = 0) {
    return async (item: JobQueueItem) => {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        results.push(item.workflowId);
    };
}

describe('JobQueue', () => {
    it('processes jobs sequentially', async () => {
        const processed: string[] = [];
        const q = new JobQueue(createProcessor(processed, 10), 1);
        q.enqueue({ workflowId: 'a', inputs: {} });
        q.enqueue({ workflowId: 'b', inputs: {} });
        await new Promise((r) => setTimeout(r, 50));
        expect(processed).toEqual(['a', 'b']);
    });

    it('respects concurrency limit', async () => {
        const processed: string[] = [];
        const q = new JobQueue(createProcessor(processed, 10), 2);
        q.enqueue({ workflowId: 'a', inputs: {} });
        q.enqueue({ workflowId: 'b', inputs: {} });
        q.enqueue({ workflowId: 'c', inputs: {} });
        await new Promise((r) => setTimeout(r, 50));
        expect(processed.sort()).toEqual(['a', 'b', 'c'].sort());
    });

    it('emits progress events', async () => {
        const events: string[] = [];
        const q = new JobQueue(async () => {}, 1);
        q.on('progress', (e) => events.push(e.status));
        q.enqueue({ workflowId: 'x', inputs: {} });
        await new Promise((r) => setTimeout(r, 10));
        expect(events).toContain('queued');
        expect(events).toContain('processing');
        expect(events).toContain('completed');
    });
});
