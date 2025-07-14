export interface ComponentData {
  id: string;
  name: string;
  data: any;
}

export interface ConnectionData {
  sourceId: string;
  sourceIndex: number;
  targetId: string;
  targetIndex: number;
}

export interface WorkflowData {
  version: string;
  components: ComponentData[];
  connections: ConnectionData[];
}

/**
 * Convert ReactFlow nodes and edges into the Agent workflow format.
 */
export function serializeWorkflow(nodes: any[], edges: any[]): WorkflowData {
  const components = nodes.map((n) => ({
    id: n.id,
    name: n.type,
    data: n.data?.params || {},
  }));

  const connections = edges.map((e) => ({
    sourceId: e.source,
    sourceIndex: 0,
    targetId: e.target,
    targetIndex: 0,
  }));

  return {
    version: '1.0.0',
    components,
    connections,
  };
}
