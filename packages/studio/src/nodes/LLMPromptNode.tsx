import React from 'react';
import { Handle, Position } from 'reactflow';

export default function LLMPromptNode({ data }: any) {
  return (
    <div style={{ padding: 10, border: '1px solid #999', borderRadius: 4 }}>
      <div>{data.label || 'LLMPrompt'}</div>
      <pre data-testid="node-data">{JSON.stringify(data.params || {})}</pre>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
