import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [];
const initialEdges: any[] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const addNode = () => {
    setNodes((nds) => [
      ...nds,
      {
        id: `${nds.length}`,
        position: { x: Math.random() * 250, y: Math.random() * 250 },
        data: { label: `Node ${nds.length}` },
        type: 'default',
      },
    ]);
  };

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), []);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        <div style={{ width: 150, borderRight: '1px solid #ccc', padding: 10 }}>
          <button onClick={addNode}>Add Node</button>
        </div>
        <div style={{ flexGrow: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
