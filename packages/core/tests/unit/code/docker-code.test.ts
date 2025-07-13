import { describe, it, expect } from 'vitest';
import { DockerCode } from '@sre/ComputeManager/Code.service/connectors/DockerCode.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

// Skip test if Docker is not available
function dockerAvailable() {
  try {
    const fs = require('fs');
    return fs.existsSync('/var/run/docker.sock');
  } catch {
    return false;
  }
}

describe('DockerCode Connector', () => {
  const available = dockerAvailable();
  (available ? it : it.skip)('runs python code in container', async () => {
    const connector = new DockerCode();
    const docker = AccessCandidate.agent('test');
    await connector.agent(docker.id).deploy('hello', { code: "print('hello')" }, { runtime: 'python:3.12-slim' });
    const result = await connector.agent(docker.id).execute('hello', {}, { runtime: 'python:3.12-slim', timeout: 5000 });
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('hello');
  });
});
