/**
 * TypeScript Declaration for Google GenAI Node.js Import
 *
 * Bridges the gap between '@google/genai/node' and '@google/genai'.
 * Removes TypeScript errors until upstream adds proper typing.
 */
declare module '@google/genai/node' {
    export * from '@google/genai';
}