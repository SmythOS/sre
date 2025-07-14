/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import App from '../../src/App';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-ignore
global.ResizeObserver = ResizeObserver;

describe('App component', () => {
  it('renders component names after fetch', async () => {
    const components = [{ name: 'TextInput' }, { name: 'HTTPCall' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => components,
    }) as any;

    render(<App />);

    for (const comp of components) {
      expect(await screen.findByText(comp.name)).toBeTruthy();
    }
  });

  it('allows editing node parameters', async () => {
    const components = [
      { name: 'TextInput', settings: { placeholder: { type: 'string' } } },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => components,
    }) as any;

    render(<App />);

    const btn = await screen.findByText('TextInput');
    fireEvent.click(btn);

    const [btnNode, nodeEl] = await screen.findAllByText('TextInput');
    fireEvent.click(nodeEl);

    const input = await screen.findByTestId('param-placeholder');
    fireEvent.change(input, { target: { value: 'hello' } });

    expect((input as HTMLInputElement).value).toBe('hello');
    const pre = await screen.findByTestId('node-data');
    expect(pre.textContent).toContain('hello');
  });
});
