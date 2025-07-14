import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/index';

let app: ReturnType<typeof createApp> extends Promise<infer U> ? U : never;

beforeAll(async () => {
  app = await createApp();
});

describe('studio-server', () => {
  it('GET /components returns component list', async () => {
    const res = await request(app).get('/components');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBeDefined();
  });

  it('POST /execute runs workflow', async () => {
    const workflowPath = path.join(__dirname, '../workflows/echo.smyth');
    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    const tmpOutput = path.join(__dirname, 'tmp-output.txt');
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
    const res = await request(app)
      .post('/execute')
      .send({ workflow, prompt: 'hello world', outputPaths: { end: tmpOutput } })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(fs.existsSync(tmpOutput)).toBe(true);
    fs.unlinkSync(tmpOutput);
  });
});
