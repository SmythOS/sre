/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import App from '../../src/App';

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
});
