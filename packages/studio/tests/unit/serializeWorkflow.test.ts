import { describe, it, expect } from 'vitest';
import { serializeWorkflow } from '../../src/utils/serializeWorkflow';

describe('serializeWorkflow', () => {
  it('converts nodes to components', () => {
    const nodes = [
      { id: '1', type: 'TextInput', data: { params: { placeholder: 'hi' } } },
    ];
    const edges: any[] = [];
    const wf = serializeWorkflow(nodes, edges);
    expect(wf.components).toEqual([
      { id: '1', name: 'TextInput', data: { placeholder: 'hi' } },
    ]);
    expect(wf.connections).toEqual([]);
  });

  it('converts edges to connections', () => {
    const nodes = [
      { id: '1', type: 'TextInput', data: { params: {} } },
      { id: '2', type: 'HTTPCall', data: { params: {} } },
    ];
    const edges = [
      { source: '1', target: '2' },
    ];
    const wf = serializeWorkflow(nodes, edges);
    expect(wf.connections).toEqual([
      { sourceId: '1', sourceIndex: 0, targetId: '2', targetIndex: 0 },
    ]);
  });

  it('handles LLMPrompt and CodeExec nodes', () => {
    const nodes = [
      { id: '1', type: 'LLMPrompt', data: { params: { text: 'hi' } } },
      { id: '2', type: 'CodeExec', data: { params: { code: 'return 1;' } } },
    ];
    const edges: any[] = [];
    const wf = serializeWorkflow(nodes, edges);
    expect(wf.components).toEqual([
      { id: '1', name: 'LLMPrompt', data: { text: 'hi' } },
      { id: '2', name: 'CodeExec', data: { code: 'return 1;' } },
    ]);
  });
});
