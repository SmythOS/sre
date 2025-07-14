export interface ComponentDef {
    name: string;
    inputs?: Record<string, { type?: string }>;
    outputs?: Record<string, { type?: string }>;
}

export function canConnect(
    params: { source?: string; target?: string },
    nodes: Array<{ id: string; type?: string }>,
    components: ComponentDef[],
): boolean {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const targetNode = nodes.find((n) => n.id === params.target);
    if (!sourceNode || !targetNode) return true;
    const sourceComp = components.find((c) => c.name === sourceNode.type);
    const targetComp = components.find((c) => c.name === targetNode.type);
    if (!sourceComp || !targetComp) return true;
    const sourceType = firstType(sourceComp.outputs);
    const targetType = firstType(targetComp.inputs);
    if (!sourceType || !targetType) return true;
    return sourceType === targetType;
}

function firstType(defs?: Record<string, { type?: string }>): string | null {
    if (!defs) return null;
    const key = Object.keys(defs)[0];
    if (!key) return null;
    return defs[key]?.type || null;
}
