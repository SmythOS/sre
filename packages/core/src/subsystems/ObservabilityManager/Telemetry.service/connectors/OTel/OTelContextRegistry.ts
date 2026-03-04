// OTelContextRegistry.ts
import { trace, Span } from '@opentelemetry/api';

interface ProcessContext {
    processId: string;
    agentId: string;
    rootSpan: Span;
    currentSpan?: Span;
}

export class OTelContextRegistry {
    private static registry = new Map<string, ProcessContext>();

    static key(agentId: string, processId: string) {
        return `${agentId}:${processId}`;
    }

    static startProcess(agentId: string, processId: string, span: Span) {
        this.registry.set(this.key(agentId, processId), { agentId, processId, rootSpan: span });
    }

    static get(agentId: string, processId: string) {
        return this.registry.get(this.key(agentId, processId));
    }

    static update(agentId: string, processId: string, ctx: Partial<ProcessContext>) {
        const key = this.key(agentId, processId);
        const current = this.registry.get(key);
        if (current) this.registry.set(key, { ...current, ...ctx });
    }

    static endProcess(agentId: string, processId: string) {
        this.registry.delete(this.key(agentId, processId));
    }
}
