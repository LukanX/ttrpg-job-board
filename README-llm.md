# LLM Provider comparison (OpenAI vs Gemini)

This small guide explains the comparison scripts and adapters added for quick prototyping.

Files added
- `lib/llm/provider.ts` - provider-agnostic entrypoint: `generateJob(provider, prompt, opts)`
- `lib/llm/openai.ts` - OpenAI adapter using the `openai` package (requires `OPENAI_API_KEY`)
- `lib/llm/gemini.ts` - Gemini adapter (fetch-based example — verify API details; requires `GOOGLE_API_KEY` or `GOOGLE_BEARER_TOKEN`)
- `scripts/llm_compare.ts` - simple runner that calls each provider (25 requests by default) and writes results to `tmp/llm_results/`.

How to run

1. Install project deps (if not already installed):

```powershell
npm install
```

2. Run the comparison using `ts-node` via npx (no global install required):

```powershell
npx ts-node-esm scripts/llm_compare.ts
```

Environment variables
- `OPENAI_API_KEY` - required to test OpenAI adapter
- `GOOGLE_API_KEY` or `GOOGLE_BEARER_TOKEN` - required to test Gemini adapter

Notes and caveats
- The Gemini adapter is a best-effort example. Google Cloud/ Gemini endpoints and request shapes change — verify the correct endpoint and request body in the official Google Cloud Generative AI docs before using in production.
- The OpenAI adapter uses the installed `openai` package; its returned shapes vary by client version. The adapter attempts to extract the generated text from common fields.
- This is intended for local prototyping and comparison only. Do not ship API keys in source or commit them to version control.

Next steps
- If you'd like, I can:
  - Run this script in your environment and analyze the `tmp/llm_results/*.json` outputs.
  - Add simple heuristics to validate generated JSON (schema checks) and compute quality metrics.
