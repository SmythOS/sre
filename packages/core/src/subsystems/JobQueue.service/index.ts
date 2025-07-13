import EventEmitter from 'events';

export interface JobQueueItem {
    workflowId: string;
    inputs: Record<string, any>;
    metadata?: Record<string, any>;
}

export interface JobProgressEvent {
    workflowId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    metadata?: Record<string, any>;
    error?: any;
}

export class JobQueue extends EventEmitter {
    private queue: JobQueueItem[] = [];
    private active = 0;

    constructor(private processor: (item: JobQueueItem) => Promise<void>, private concurrency = 1) {
        super();
        if (this.concurrency < 1) this.concurrency = 1;
    }

    public enqueue(item: JobQueueItem) {
        this.queue.push(item);
        this.emitProgress(item, 'queued');
        this.process();
    }

    private emitProgress(item: JobQueueItem, status: JobProgressEvent['status'], error?: any) {
        const event: JobProgressEvent = { workflowId: item.workflowId, status, metadata: item.metadata };
        if (error) event.error = error;
        this.emit('progress', event);
    }

    private process() {
        while (this.active < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift() as JobQueueItem;
            this.active++;
            this.emitProgress(item, 'processing');
            this.processor(item)
                .then(() => this.emitProgress(item, 'completed'))
                .catch((err) => this.emitProgress(item, 'failed', err))
                .finally(() => {
                    this.active--;
                    this.process();
                });
        }
    }
}
