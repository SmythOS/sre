import { parseSafe } from './jsonSafe';
import { SDKLog } from './console.utils';
import { jsonrepair as repair } from 'jsonrepair';

export type TParseStructuredOptions = {
  repair?: boolean; // use jsonrepair before parsing
  strict?: boolean; // if true, only accept top-level object/array JSON blocks
  maxScanChars?: number; // limit scanning for inline JSON
};

export type TParseStructuredResult<T = unknown> = {
  data: T | null;
  jsonText: string | null;
  source: 'block' | 'inline' | 'raw' | 'none';
  repaired: boolean;
  error?: Error | null;
};

/**
 * Extract fenced JSON code blocks from text, prioritizing ```json blocks.
 */
export function extractJsonBlocks(text: string): string[] {
  if (!text) return [];
  const blocks: string[] = [];
  // ```json\n...\n```
  const jsonFence = /```json\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonFence.exec(text))) {
    blocks.push(m[1].trim());
  }
  // generic ```...``` where content looks like JSON
  const anyFence = /```\s*\n([\s\S]*?)```/gi;
  while ((m = anyFence.exec(text))) {
    const body = (m[1] || '').trim();
    if (looksLikeJson(body)) blocks.push(body);
  }
  return dedupe(blocks);
}

/** Heuristic check if a string appears to be JSON */
export function looksLikeJson(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  const starts = trimmed[0];
  const ends = trimmed[trimmed.length - 1];
  return (
    (starts === '{' && ends === '}') ||
    (starts === '[' && ends === ']')
  );
}

/**
 * Attempt to find the first balanced JSON object or array in freeform text.
 * Uses a simple bracket counter with early-exit for speed.
 */
export function extractFirstInlineJson(text: string, maxScanChars = 50_000): string | null {
  if (!text) return null;
  const src = text.slice(0, maxScanChars);
  const openers = ['{', '['] as const;
  const closers: Record<string, string> = { '{': '}', '[': ']' };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (openers.includes(ch as any)) {
      const closer = closers[ch];
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') inString = !inString;
        if (inString) continue;
        if (c === ch) depth++;
        else if (c === closer) depth--;
        if (depth === 0) {
          const candidate = src.slice(i, j + 1).trim();
          if (looksLikeJson(candidate)) return candidate;
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Repair malformed JSON using jsonrepair with safe fallback.
 */
export function repairJson(input: string): string {
  try {
    return repair(input);
  } catch (e) {
    // Fallback: attempt simple fixes (remove trailing commas)
    try {
      const noTrailingCommas = input
        // remove trailing commas in objects/arrays
        .replace(/,\s*([}\]])/g, '$1');
      return noTrailingCommas;
    } catch {
      return input;
    }
  }
}

/**
 * Parse structured JSON from freeform LLM output or any text.
 * Strategy:
 * 1) Use fenced ```json blocks
 * 2) Fallback to inline balanced JSON scan
 * 3) As a last resort, try to repair+parse entire text if it looks like JSON
 */
export function parseStructured<T = unknown>(
  text: string,
  opts: TParseStructuredOptions = {}
): TParseStructuredResult<T> {
  const { repair: useRepair = true, strict = false, maxScanChars = 50_000 } = opts;

  // 1) Fenced blocks
  const blocks = extractJsonBlocks(text);
  for (const b of blocks) {
    const parsed = tryParse<T>(b, useRepair);
    if (parsed.ok) return { data: parsed.value as T, jsonText: parsed.text, source: 'block', repaired: parsed.repaired, error: null };
  }

  // 2) Inline JSON scan
  if (!strict) {
    const inline = extractFirstInlineJson(text, maxScanChars);
    if (inline) {
      const parsed = tryParse<T>(inline, useRepair);
      if (parsed.ok) return { data: parsed.value as T, jsonText: parsed.text, source: 'inline', repaired: parsed.repaired, error: null };
    }
  }

  // 3) If the entire text looks like JSON
  if (looksLikeJson(text)) {
    const parsed = tryParse<T>(text, useRepair);
    if (parsed.ok) return { data: parsed.value as T, jsonText: parsed.text, source: 'raw', repaired: parsed.repaired, error: null };
  }

  return { data: null, jsonText: null, source: 'none', repaired: false, error: new Error('No valid JSON found') };
}

function tryParse<T>(jsonText: string, useRepair: boolean): { ok: boolean; value?: T; text: string; repaired: boolean } {
  let text = jsonText;
  let repaired = false;
  let result = parseSafe<T>(text);
  if (typeof result !== 'string' && result !== undefined) {
    return { ok: true, value: result as T, text, repaired };
  }
  if (useRepair) {
    try {
      text = repairJson(jsonText);
      repaired = text !== jsonText;
      const repairedResult = parseSafe<T>(text);
      if (typeof repairedResult !== 'string' && repairedResult !== undefined) {
        return { ok: true, value: repairedResult as T, text, repaired };
      }
    } catch (e) {
      SDKLog.debug('structuredOutput: repair failed', e);
    }
  }
  return { ok: false, text, repaired };
}

export type TSchema = Record<string, any>;

/**
 * Create a strict JSON-only instruction for LLMs with an example schema.
 */
export function createSchemaPrompt(schema: TSchema, options?: { title?: string; strict?: boolean }): string {
  const { title = 'Structured JSON Output', strict = true } = options || {};
  const schemaExample = JSON.stringify(schema, null, 2);
  return [
    title,
    '',
    'Respond ONLY with a single JSON value matching the schema below.',
    strict ? 'Do not include any prose before or after the JSON. No markdown fences.' : 'Prefer JSON-only output.',
    '',
    'Schema (example shape):',
    '```json',
    schemaExample,
    '```',
  ].join('\n');
}

function dedupe<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
