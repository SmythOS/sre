import React, { useCallback, useEffect, useState } from 'react';
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
  const [components, setComponents] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadComponents() {
      try {
        const res = await fetch('http://localhost:3010/components');
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setComponents(data);
      } catch (err) {
        console.error('Failed to fetch components', err);
        setError('Failed to load components');
      }
    }

    loadComponents();
  }, []);

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

  const executeWorkflow = async () => {
    const workflow = { nodes, edges };
    const res = await fetch('http://localhost:3010/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, prompt }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data));
  };

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        <div style={{ width: 150, borderRight: '1px solid #ccc', padding: 10 }}>
          <button onClick={addNode}>Add Node</button>
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Prompt"
            />
            <button onClick={executeWorkflow} style={{ display: 'block', marginTop: 5 }}>
              Execute
            </button>
          </div>
          {error && (
            <div style={{ color: 'red', marginTop: 10 }}>{error}</div>
          )}
          <ul>
            {components.map((c) => (
              <li key={c.name}>{c.name}</li>
            ))}
          </ul>
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
          {result && (
            <pre style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: 200, overflow: 'auto', background: '#eee', margin: 0 }}>
              {result}
            </pre>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
