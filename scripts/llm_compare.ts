/**
 * Small comparison script that calls both adapters sequentially and saves results.
 *
 * Usage (from repo root):
 *   npx ts-node-esm scripts/llm_compare.ts
 *
 * Environment variables required:
 *  - OPENAI_API_KEY for OpenAI adapter
 *  - GOOGLE_API_KEY or GOOGLE_BEARER_TOKEN for Gemini adapter
 */

import fs from 'fs'
import path from 'path'
import { generateJob } from '../lib/llm/provider'

const OUT_DIR = path.resolve(process.cwd(), 'tmp', 'llm_results')
fs.mkdirSync(OUT_DIR, { recursive: true })

const PROMPT = `Generate a JSON object for a Starfinder 2E job posting.
Fields: id, title, hook, difficulty (1-10), reward, gm_notes (secret), encounters (array), npcs (array).
Keep the output compact and valid JSON only.`

async function run(provider: 'openai' | 'gemini', count = 25) {
  const results: any[] = []

  for (let i = 0; i < count; i++) {
    const start = Date.now()
    try {
      const res = await generateJob(provider, PROMPT, { maxTokens: 600, temperature: 0.6 })
      const elapsed = Date.now() - start
      results.push({ index: i, ok: true, elapsed, provider: res.provider, model: res.model, text: res.text })
      // Respectful pause to avoid immediate rate limits
      await new Promise((r) => setTimeout(r, 200))
    } catch (err: any) {
      const elapsed = Date.now() - start
      results.push({ index: i, ok: false, elapsed, error: err?.message ?? String(err) })
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const outPath = path.join(OUT_DIR, `${provider}.json`)
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`Wrote ${results.length} results to ${outPath}`)
}

async function main() {
  console.log('Starting LLM comparison. This will call each provider up to 25 times.')
  console.log('Make sure credentials are set in environment variables before running.')

  // Run OpenAI if key found
  if (process.env.OPENAI_API_KEY) {
    console.log('Running OpenAI tests...')
    await run('openai')
  } else {
    console.log('Skipping OpenAI: OPENAI_API_KEY not set')
  }

  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_BEARER_TOKEN) {
    console.log('Running Gemini tests...')
    await run('gemini')
  } else {
    console.log('Skipping Gemini: GOOGLE_API_KEY or GOOGLE_BEARER_TOKEN not set')
  }

  console.log('Done')
}

main().catch((err) => {
  console.error('Script failed', err)
  process.exit(1)
})
