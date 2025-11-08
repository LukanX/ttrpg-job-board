const fs = require('fs')
const path = require('path')

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  raw.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return
    const parts = line.split('=')
    if (parts.length < 2) return
    const name = parts.shift().trim()
    const value = parts.join('=').trim()
    if (!process.env[name]) process.env[name] = value
  })
}

loadEnvFile(path.resolve(process.cwd(), '.env'))

const OUT_DIR = path.resolve(process.cwd(), 'tmp', 'llm_results')
fs.mkdirSync(OUT_DIR, { recursive: true })

const PROMPT = `Generate a JSON object for a Starfinder 2E job posting.\nFields: id, title, hook, difficulty (1-10), reward, gm_notes (secret), encounters (array), npcs (array).\nKeep the output compact and valid JSON only.`

async function callOpenAI(prompt, opts = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  // Respect env override or option; default to gpt-4o-mini for reliability
  const model = opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    // Allow overriding max tokens via env or options. Newer OpenAI models expect 'max_completion_tokens'.
    max_completion_tokens: opts.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? '512'),
  }

  // Some newer OpenAI models (eg. gpt-5 variants) do not accept custom temperature values.
  // Only include temperature when the caller explicitly sets it and the model is not a gpt-5 variant.
  const isGpt5 = typeof model === 'string' && model.toLowerCase().includes('gpt-5')
  if (opts.temperature !== undefined && !isGpt5) {
    body.temperature = opts.temperature
  }

  // Use the Responses API for gpt-5 models which may not behave as chat completions.
  if (isGpt5) {
    const respBody = {
      model,
      input: prompt,
      // Responses API uses max_output_tokens. Default higher for gpt-5 to avoid truncation.
      max_output_tokens: opts.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? (isGpt5 ? '1500' : '512')),
    }
    // Do not set temperature for gpt-5 models if they don't support it; omit unless explicitly allowed via env
    if (opts.temperature !== undefined && process.env.OPENAI_ALLOW_TEMPERATURE === 'true') {
      respBody.temperature = opts.temperature
    }

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(respBody),
    })

    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`OpenAI (responses) request failed ${resp.status}: ${t}`)
    }

    const json = await resp.json()
    return json
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`OpenAI request failed ${resp.status}: ${t}`)
  }
  return resp.json()
}

async function callGemini(prompt, opts = {}) {
  const apiKey = process.env.GOOGLE_API_KEY
  const bearer = process.env.GOOGLE_BEARER_TOKEN
  if (!apiKey && !bearer) throw new Error('No Google credential found')
  const model = opts.model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: opts.temperature ?? 0.6,
      // Default to env override or 1500 (previously increased). To reduce token usage, lower this value.
      maxOutputTokens: opts.maxTokens ?? Number(process.env.GOOGLE_GEMINI_MAX_TOKENS ?? '1500'),
      // Request single candidate to avoid extra token overhead
      candidateCount: 1,
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Gemini request failed ${resp.status}: ${t}`)
  }
  return resp.json()
}

async function runProvider(name, fn, count = 5, defaultOpts = {}) {
  const results = []
  for (let i = 0; i < count; i++) {
    const start = Date.now()
    try {
      const opts = Object.assign({ maxTokens: 600, temperature: 0.6 }, defaultOpts)
      const res = await fn(PROMPT, opts)
      const elapsed = Date.now() - start
      results.push({ index: i, ok: true, elapsed, provider: name, raw: res })
    } catch (err) {
      const elapsed = Date.now() - start
      results.push({ index: i, ok: false, elapsed, error: String(err) })
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  const outPath = path.join(OUT_DIR, `${name}.json`)
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`Wrote ${results.length} results to ${outPath}`)
}

async function main() {
  console.log('Running Node comparison (small sample)')
  if (process.env.OPENAI_API_KEY) {
    console.log('Running OpenAI (Node)')
    // For modern OpenAI models increase max tokens to avoid truncation
    await runProvider('openai_node', callOpenAI, 5, { maxTokens: 1500 })
  } else {
    console.log('Skipping OpenAI: OPENAI_API_KEY not set')
  }

  if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_BEARER_TOKEN) {
    console.log('Running Gemini (Node)')
    await runProvider('gemini_node', callGemini, 5, { maxTokens: 1500 })
  } else {
    console.log('Skipping Gemini: no GOOGLE_API_KEY or GOOGLE_BEARER_TOKEN set')
  }

  console.log('Done')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
