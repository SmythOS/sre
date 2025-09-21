import { AgentGraphLike, GraphComponent, GraphConnection, ValidationIssue, ValidationResult, ValidatorOptions } from './types';

function makeIssue(
    severity: 'error' | 'warning',
    code: string,
    message: string,
    componentIds: string[],
    hint?: string,
    cyclePath?: string[],
): ValidationIssue {
    return { severity, code, message, componentIds, hint, cyclePath };
}

export class WorkflowValidatorService {
    constructor(private readonly options: ValidatorOptions = {}) {}

    validate(graph: AgentGraphLike): ValidationResult {
        const issues: ValidationIssue[] = [];

        const { components, connections } = graph || { components: [], connections: [] };

        // Basic presence checks
        if (!Array.isArray(components) || !Array.isArray(connections)) {
            issues.push(
                makeIssue('error', 'GRAPH_INVALID', 'Agent graph is missing components or connections arrays', [],
                    'Ensure agent.data includes both components and connections arrays'),
            );
            return this.finalize(issues, undefined);
        }

        // Build component maps and check duplicates
        const idToComponent = new Map<string, GraphComponent>();
        for (const c of components) {
            if (!c?.id) {
                issues.push(
                    makeIssue('error', 'COMPONENT_ID_MISSING', 'A component is missing an id', [], 'Assign a unique id to each component'),
                );
                continue;
            }
            if (idToComponent.has(c.id)) {
                issues.push(
                    makeIssue('error', 'DUPLICATE_COMPONENT_ID', `Duplicate component id '${c.id}'`, [c.id],
                        'Ensure all component ids are unique'),
                );
            } else {
                idToComponent.set(c.id, c);
            }
        }

        // Validate connections: referenced ids and IO indices/names
        for (const con of connections) {
            const source = idToComponent.get(con.sourceId);
            const target = idToComponent.get(con.targetId);
            if (!source) {
                issues.push(
                    makeIssue('error', 'MISSING_SOURCE', `Connection references missing source component '${con.sourceId}'`,
                        [con.sourceId].filter(Boolean) as string[], 'Add the source component or remove the invalid connection'),
                );
                continue;
            }
            if (!target) {
                issues.push(
                    makeIssue('error', 'MISSING_TARGET', `Connection references missing target component '${con.targetId}'`,
                        [con.targetId].filter(Boolean) as string[], 'Add the target component or remove the invalid connection'),
                );
                continue;
            }

            // Validate sourceIndex against outputs
            const sourceOk = this.validateEndpoint(source.outputs || [], con.sourceIndex);
            if (!sourceOk.ok) {
                issues.push(
                    makeIssue(
                        'error',
                        'INVALID_SOURCE_INDEX',
                        `Invalid connection sourceIndex '${con.sourceIndex}' on component '${source.id}'`,
                        [source.id],
                        sourceOk.hint,
                    ),
                );
            }

            // Validate targetIndex against inputs
            const targetOk = this.validateEndpoint(target.inputs || [], con.targetIndex);
            if (!targetOk.ok) {
                issues.push(
                    makeIssue(
                        'error',
                        'INVALID_TARGET_INDEX',
                        `Invalid connection targetIndex '${con.targetIndex}' on component '${target.id}'`,
                        [target.id],
                        targetOk.hint,
                    ),
                );
            }
        }

        // Cycle detection and topological order
        const { hasCycle, cyclePath, topoOrder } = this.detectCyclesAndTopoOrder(components, connections);
        if (hasCycle) {
            const cycleComponentNames = (cyclePath || []).map((id) => idToComponent.get(id)?.name || id);
            const msg = `Cycle detected: ${cycleComponentNames.join(' -> ')}`;
            const allow = this.options.cycleWarningAllowlistNames || [];
            const cycleNames = new Set(cycleComponentNames);
            const onlyAllowlisted = cycleNames.size > 0 && [...cycleNames].every((n) => allow.includes(n));
            const severity = onlyAllowlisted ? 'warning' : 'error';
            const hint = onlyAllowlisted
                ? 'Cycle includes allowed components; ensure it will converge or produces async behavior as intended'
                : 'Remove the cycle or refactor workflow to be acyclic';
            issues.push(makeIssue(severity, 'CYCLE_DETECTED', msg, cyclePath || [], hint, cyclePath));
        }

        // Unreachable (dead) components: not reachable from any entry
        const entryIds = this.computeEntryComponents(components, connections);
        const reachable = this.computeReachable(entryIds, connections);
        for (const c of components) {
            if (!reachable.has(c.id)) {
                issues.push(
                    makeIssue(
                        'warning',
                        'DEAD_COMPONENT',
                        `Component '${c.id}' is unreachable (dead)`,
                        [c.id],
                        'Connect it to the flow or remove it if unused',
                    ),
                );
            }
        }

        // Missing required inputs for each reachable component
        const incomingByTarget = new Map<string, GraphConnection[]>();
        for (const con of connections) {
            if (!incomingByTarget.has(con.targetId)) incomingByTarget.set(con.targetId, []);
            incomingByTarget.get(con.targetId)!.push(con);
        }
        for (const c of components) {
            // Skip unreachable components for required input checks only when there is at least one connection in the graph.
            // In a connection-less graph, validate required inputs for standalone components.
            if (connections.length > 0 && !reachable.has(c.id)) continue;
            const inputs = c.inputs || [];
            if (inputs.length === 0) continue;
            const incoming = incomingByTarget.get(c.id) || [];
            const mappedNames = new Set<string>();
            for (const con of incoming) {
                const normalized = this.resolveEndpointName(inputs, con.targetIndex);
                if (normalized) mappedNames.add(normalized);
            }
            for (const inp of inputs) {
                const isRequired = !(inp.optional || inp.default);
                if (isRequired && !mappedNames.has(inp.name)) {
                    issues.push(
                        makeIssue(
                            'error',
                            'MISSING_REQUIRED_INPUT',
                            `Component '${c.id}' is missing required input '${inp.name}' mapping`,
                            [c.id],
                            'Connect this input from an upstream component output or mark it optional',
                        ),
                    );
                }
            }
        }

        // finalize
        const result = this.finalize(issues, hasCycle ? undefined : topoOrder);
        return result;
    }

    private validateEndpoint(defs: { name: string }[], indexOrName: number | string): { ok: boolean; hint?: string } {
        const names = defs.map((d) => d.name);
        if (typeof indexOrName === 'number') {
            const ok = indexOrName >= 0 && indexOrName < defs.length;
            return ok ? { ok } : { ok: false, hint: `Use an index between 0 and ${Math.max(0, defs.length - 1)}` };
        }
        // treat as name
        const ok = names.includes(String(indexOrName));
        return ok ? { ok } : { ok: false, hint: `Use one of: ${names.join(', ')}` };
    }

    private resolveEndpointName(defs: { name: string }[], indexOrName: number | string): string | undefined {
        if (typeof indexOrName === 'number') {
            return defs[indexOrName]?.name;
        }
        const name = String(indexOrName);
        return defs.find((d) => d.name === name)?.name;
    }

    private detectCyclesAndTopoOrder(components: GraphComponent[], connections: GraphConnection[]): {
        hasCycle: boolean;
        cyclePath?: string[];
        topoOrder?: string[];
    } {
        const idSet = new Set(components.map((c) => c.id));
        const adj = new Map<string, string[]>();
        for (const c of components) adj.set(c.id, []);
        for (const con of connections) {
            if (idSet.has(con.sourceId) && idSet.has(con.targetId)) {
                adj.get(con.sourceId)!.push(con.targetId);
            }
        }

        const tempMark = new Set<string>();
        const permMark = new Set<string>();
        const order: string[] = [];
        const stack: string[] = [];
        let cycle: string[] | undefined;

        const visit = (node: string) => {
            if (permMark.has(node)) return;
            if (tempMark.has(node)) {
                // found cycle; extract path from stack
                const i = stack.lastIndexOf(node);
                cycle = i >= 0 ? stack.slice(i).concat(node) : [node, node];
                return;
            }
            tempMark.add(node);
            stack.push(node);
            for (const n of adj.get(node) || []) {
                if (cycle) break;
                visit(n);
            }
            stack.pop();
            tempMark.delete(node);
            permMark.add(node);
            order.push(node);
        };

        for (const c of components) {
            if (!permMark.has(c.id)) {
                visit(c.id);
                if (cycle) break;
            }
        }

        // reverse to ensure sources come first (standard topo order)
        return { hasCycle: !!cycle, cyclePath: cycle, topoOrder: cycle ? undefined : order.reverse() };
    }

    private computeEntryComponents(components: GraphComponent[], connections: GraphConnection[]): string[] {
        // Entry nodes: components that are APIEndpoint, or have no incoming edges
        const incoming = new Map<string, number>();
        for (const c of components) incoming.set(c.id, 0);
        for (const con of connections) {
            incoming.set(con.targetId, (incoming.get(con.targetId) || 0) + 1);
        }
        const entries = components
            .filter((c) => {
                const indeg = incoming.get(c.id) || 0;
                const hasDeclaredInputs = Array.isArray(c.inputs) && c.inputs.length > 0;
                // Treat as entry only if explicitly an APIEndpoint, or it truly has no input dependencies
                // Nodes with indegree 0 but declared inputs (required or not) are NOT entries.
                return c.name === 'APIEndpoint' || (!hasDeclaredInputs && indeg === 0);
            })
            .map((c) => c.id);
        return entries;
    }

    private computeReachable(entryIds: string[], connections: GraphConnection[]): Set<string> {
        const adj = new Map<string, string[]>();
        for (const con of connections) {
            if (!adj.has(con.sourceId)) adj.set(con.sourceId, []);
            adj.get(con.sourceId)!.push(con.targetId);
        }
        const visited = new Set<string>();
        const stack = [...entryIds];
        for (const id of entryIds) visited.add(id);
        while (stack.length) {
            const cur = stack.pop()!;
            for (const n of adj.get(cur) || []) {
                if (!visited.has(n)) {
                    visited.add(n);
                    stack.push(n);
                }
            }
        }
        return visited;
    }

    private finalize(issues: ValidationIssue[], topoOrder?: string[]): ValidationResult {
        const errors = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');
        return {
            isValid: errors.length === 0,
            issues,
            errors,
            warnings,
            topologicalOrder: topoOrder,
        };
    }
}


