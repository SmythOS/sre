export interface SerializedWorkflow {
  components: Array<{ id: string; name: string; data?: any }>;
  connections: Array<{ sourceId: string; sourceIndex: number; targetId: string; targetIndex: number }>;
}

export function deserializeWorkflow(workflow: SerializedWorkflow) {
  const nodes = (workflow.components || []).map((c, idx) => ({
    id: c.id,
    type: c.name,
    position: { x: idx * 50, y: idx * 80 },
    data: { label: c.name, params: c.data || {} },
  }));

  const edges = (workflow.connections || []).map((c, idx) => ({
    id: `e${idx}`,
    source: c.sourceId,
    target: c.targetId,
  }));

  return { nodes, edges };
}
