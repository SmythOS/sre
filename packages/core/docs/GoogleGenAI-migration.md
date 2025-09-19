# Migration to @google/genai for Embeddings (Gemini)

## Overview
This document describes the migration of the SmythOS SRE core package from the deprecated `@google/generative-ai` SDK to the new `@google/genai` SDK for Gemini/GenAI embeddings. It covers the rationale, code changes, test updates, and integration instructions.

---

## Why Migrate?
- **Deprecation:** `@google/generative-ai` is deprecated and no longer maintained.
- **Features:** `@google/genai` provides improved API stability, new models, and better support for Gemini embeddings.
- **Security:** Ensures compatibility with Google’s latest authentication and API standards.

---

## Key Changes
### 1. Dependency Update
- Removed: `@google/generative-ai`
- Added: `@google/genai`
- Updated all imports and usage to reference the new SDK.

### 2. Connector Refactor
- File: `packages/core/src/subsystems/IO/VectorDB.service/embed/GoogleEmbedding.ts`
- Replaced all usage of deprecated classes and methods with `GoogleGenAI` and its `models.embedContent` method.
- API calls now use:
  ```ts
  client.models.embedContent({ model, contents })
  ```
- Added support for batch embeddings and output normalization as recommended by Google documentation.

### 3. Test Updates
- File: `packages/core/tests/unit/embeddings/GoogleEmbedding.test.ts`
- Updated all mocks to match the new argument shape: `{ model, contents }`.
- Updated test expectations to match normalized output vectors.
- Ensured all Gemini/GenAI embedding tests pass with the new SDK.

### 4. Error Handling
- Improved error handling for missing API keys and invalid embedding responses.
- Connector now throws clear errors if credentials or environment variables are missing.

---

## How to Use
### API Key Setup
- Set your Google API key in the environment:
  ```sh
  export GOOGLE_AI_API_KEY="your-api-key-here"
  ```
- Or provide credentials via the SRE credential system.

### Supported Models
- `gemini-embedding-001`
- `text-embedding-005`
- `text-multilingual-embedding-002`

### Example Usage
```ts
const googleEmbeds = new GoogleEmbeds({ model: 'gemini-embedding-001' });
const embedding = await googleEmbeds.embedText('your text', candidate);
```

---

## Validation
- All Gemini/GenAI embedding unit tests pass.
- No changes were made to OpenAI-related code or tests.

---

## Troubleshooting
- **API Key Error:** Ensure `GOOGLE_AI_API_KEY` is set and valid.
- **Invalid Response:** Check model name and input format.
- **Batch Issues:** Ensure input texts are chunked as expected.

---

## References
- [@google/genai documentation](https://www.npmjs.com/package/@google/genai)
- [Google Gemini API docs](https://ai.google.dev/)

---

For further questions or migration support, contact the SRE maintainers.
