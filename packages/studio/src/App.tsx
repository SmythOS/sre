import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, useEdgesState, useNodesState, ReactFlowProvider } from 'reactflow';
import { canConnect } from './utils/connectUtils';
import TextInputNode from './nodes/TextInputNode';
import HTTPCallNode from './nodes/HTTPCallNode';
import LLMPromptNode from './nodes/LLMPromptNode';
import CodeExecNode from './nodes/CodeExecNode';
import GitCommitNode from './nodes/GitCommitNode';
import { serializeWorkflow } from './utils/serializeWorkflow';
import { deserializeWorkflow } from './utils/deserializeWorkflow';
import 'reactflow/dist/style.css';

const initialNodes = [];
const initialEdges: any[] = [];
const nodeTypes = {
    TextInput: TextInputNode,
    HTTPCall: HTTPCallNode,
    LLMPrompt: LLMPromptNode,
    CodeExec: CodeExecNode,
    GitCommit: GitCommitNode,
};

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [components, setComponents] = useState<any[]>([]);
    const [workflows, setWorkflows] = useState<string[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState('');
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

        async function loadWorkflowsList() {
            try {
                const res = await fetch('http://localhost:3010/workflows');
                if (res.ok) {
                    const names = await res.json();
                    setWorkflows(names);
                }
            } catch (err) {
                console.error('Failed to fetch workflows', err);
            }
        }

        loadComponents();
        loadWorkflowsList();
    }, []);

    const addNode = (type: string) => {
        setNodes((nds) => [
            ...nds,
            {
                id: `${nds.length}`,
                position: { x: Math.random() * 250, y: Math.random() * 250 },
                data: { label: type, params: {} },
                type,
            },
        ]);
    };

    const onConnect = useCallback(
        (params: any) => {
            if (canConnect(params, nodes, components)) {
                setEdges((eds) => addEdge(params, eds));
                setError(null);
            } else {
                setError('Incompatible connection');
            }
        },
        [nodes, components],
    );

    const updateNodeParams = (id: string, params: any) => {
        setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, params } } : n)));
    };

    const updateNodeOutputPath = (id: string, outputPath: string) => {
        setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, outputPath } } : n)));
    };

    const saveWorkflow = async () => {
        const name = window.prompt('Workflow name');
        if (!name) return;
        const workflow = serializeWorkflow(nodes, edges);
        await fetch(`http://localhost:3010/workflows/${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workflow),
        });
        // refresh list
        try {
            const res = await fetch('http://localhost:3010/workflows');
            if (res.ok) setWorkflows(await res.json());
        } catch {}
    };

    const loadWorkflow = async (name: string) => {
        try {
            const res = await fetch(`http://localhost:3010/workflows/${encodeURIComponent(name)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const { nodes: wfNodes, edges: wfEdges } = deserializeWorkflow(data);
            setNodes(wfNodes);
            setEdges(wfEdges);
        } catch (err) {
            console.error('Failed to load workflow', err);
        }
    };

    const executeWorkflow = async () => {
        const workflow = serializeWorkflow(nodes, edges);
        const outputPaths = nodes.reduce(
            (acc: any, n) => {
                if (n.data?.outputPath) acc[n.id] = n.data.outputPath;
                return acc;
            },
            {} as Record<string, string>,
        );
        const res = await fetch('http://localhost:3010/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflow, prompt, outputPaths }),
        });
        const data = await res.json();
        setResult(JSON.stringify(data));
    };

    return (
        <ReactFlowProvider>
            <div style={{ display: 'flex', height: '100vh' }}>
                <div style={{ width: 150, borderRight: '1px solid #ccc', padding: 10 }}>
                    {components.map((c) => (
                        <button key={c.name} onClick={() => addNode(c.name)} style={{ display: 'block', marginBottom: 5 }}>
                            {c.name}
                        </button>
                    ))}
                    <div style={{ marginTop: 10 }}>
                        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt" />
                        <button onClick={executeWorkflow} style={{ display: 'block', marginTop: 5 }}>
                            Execute
                        </button>
                        <button onClick={saveWorkflow} style={{ display: 'block', marginTop: 5 }}>
                            Save
                        </button>
                        <div style={{ marginTop: 5 }}>
                            <select
                                value={selectedWorkflow}
                                onChange={(e) => setSelectedWorkflow(e.target.value)}
                                style={{ width: '100%', marginBottom: 5 }}
                            >
                                <option value="">Select workflow</option>
                                {workflows.map((w) => (
                                    <option key={w} value={w}>
                                        {w}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => selectedWorkflow && loadWorkflow(selectedWorkflow)} style={{ display: 'block', marginTop: 0 }}>
                                Load
                            </button>
                        </div>
                    </div>
                    {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
                </div>
                <div style={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
                    <div style={{ flexGrow: 1 }}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={(_, n) => setSelectedNodeId(n.id)}
                            nodeTypes={nodeTypes}
                            fitView
                        >
                            <Background />
                            <Controls />
                        </ReactFlow>
                        {result && (
                            <pre
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    maxHeight: 200,
                                    overflow: 'auto',
                                    background: '#eee',
                                    margin: 0,
                                }}
                            >
                                {result}
                            </pre>
                        )}
                    </div>
                    {selectedNodeId && (
                        <div style={{ width: 200, borderLeft: '1px solid #ccc', padding: 10 }}>
                            {components
                                .filter((c) => c.name === nodes.find((n) => n.id === selectedNodeId)?.type)
                                .map((c) => (
                                    <div key={c.name}>
                                        {Object.entries(c.settings || {}).map(([key, field]: any) => {
                                            const value = nodes.find((n) => n.id === selectedNodeId)?.data.params?.[key] ?? '';
                                            const inputProps = {
                                                'data-testid': `param-${key}`,
                                                value,
                                                onChange: (e: any) => {
                                                    const v =
                                                        field.type === 'number'
                                                            ? Number(e.target.value)
                                                            : field.type === 'boolean'
                                                              ? e.target.checked
                                                              : e.target.value;
                                                    updateNodeParams(selectedNodeId, {
                                                        ...(nodes.find((n) => n.id === selectedNodeId)?.data.params || {}),
                                                        [key]: v,
                                                    });
                                                },
                                            } as any;
                                            if (field.type === 'boolean') {
                                                return (
                                                    <label key={key} style={{ display: 'block', marginBottom: 5 }}>
                                                        {key}
                                                        <input type="checkbox" checked={!!value} {...inputProps} />
                                                    </label>
                                                );
                                            }
                                            return (
                                                <label key={key} style={{ display: 'block', marginBottom: 5 }}>
                                                    {key}
                                                    <input type="text" {...inputProps} />
                                                </label>
                                            );
                                        })}
                                    </div>
                                ))}
                            {!edges.some((e) => e.source === selectedNodeId) && (
                                <label style={{ display: 'block', marginTop: 5 }}>
                                    Output Path
                                    <input
                                        type="text"
                                        data-testid="output-path"
                                        value={nodes.find((n) => n.id === selectedNodeId)?.data.outputPath || ''}
                                        onChange={(e) => updateNodeOutputPath(selectedNodeId, e.target.value)}
                                    />
                                </label>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ReactFlowProvider>
    );
}
