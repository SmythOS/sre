/**
 * Safe JSON utilities for resilient parsing and stringification.
 *
 * - parseSafe: parse JSON with optional fallback and reviver
 * - stringifySafe: JSON.stringify with circular reference handling and optional replacer/space
 */

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue }
export interface JSONArray extends Array<JSONValue> {}

/**
 * Parse a JSON string safely.
 * @param input - JSON string or any value.
 * @param fallback - Value to return when parsing fails (defaults to undefined).
 * @param reviver - Optional reviver function (same as JSON.parse).
 */
export function parseSafe<T = unknown>(
  input: unknown,
  fallback?: T,
  reviver?: (this: any, key: string, value: any) => any
): T | unknown {
  if (typeof input !== 'string') return input as any;
  try {
    return JSON.parse(input, reviver) as T;
  } catch {
    return fallback as T;
  }
}

/**
 * Stringify a value safely, handling circular references by replacing with "[Circular]" markers.
 * @param value - Value to stringify.
 * @param replacer - Optional replacer function/array.
 * @param space - Optional space for pretty output.
 */
export function stringifySafe(
  value: any,
  replacer?: (this: any, key: string, value: any) => any | (number | string)[] | null,
  space?: number | string
): string {
  const seen = new WeakSet<any>();
  const circularReplacer = (key: string, val: any) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return typeof replacer === 'function' ? replacer.call(this, key, val) : val;
  };

  try {
    return JSON.stringify(value, replacer ?? circularReplacer as any, space);
  } catch {
    // If user-supplied replacer threw, fallback to circularReplacer
    try {
      return JSON.stringify(value, circularReplacer as any, space);
    } catch {
      return '"[Unstringifiable]"';
    }
  }
}

export const jsonSafe = { parseSafe, stringifySafe };
