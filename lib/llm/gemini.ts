import type { GenerateOptions, GenerateResult } from './provider'

/**
 * Gemini adapter (best-effort example)
 *
 * Notes:
 * - Google/ Gemini APIs change often. This adapter uses the public Generative Language
 *   REST shape as a best-effort example. Verify the exact endpoint and request body in
 *   Google Cloud docs before using in production.
 * - This code requires either GOOGLE_API_KEY (API key) or GOOGLE_BEARER_TOKEN (OAuth token).
 */

// Default to a commonly available Generative AI model identifier. You can override
// by setting GOOGLE_GEMINI_MODEL in your environment (for example: 'models/text-bison-001' or 'models/gemini-1.5').
const DEFAULT_MODEL = process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash'

export async function generateJobGemini(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const apiKey = process.env.GOOGLE_API_KEY
  const bearer = process.env.GOOGLE_BEARER_TOKEN

  if (!apiKey && !bearer) {
    throw new Error('Either GOOGLE_API_KEY or GOOGLE_BEARER_TOKEN must be set for Gemini adapter')
  }

  const model = options.model || DEFAULT_MODEL

  // Allow overriding the base endpoint if your organization needs a custom URL or different API surface.
  const base = process.env.GOOGLE_GENERATIVE_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
  
  // Modern Gemini API uses :generateContent with a contents array structure
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`

  // Request body for the current Gemini API (v1beta)
  const body: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      // Allow overriding via options or env var; default to 2000 for fuller outputs
      maxOutputTokens: options.maxTokens ?? Number(process.env.GOOGLE_GEMINI_MAX_TOKENS ?? '2000'),
      responseMimeType: 'application/json',
    },
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Gemini request failed ${resp.status}: ${text}`)
  }

  const json = await resp.json()

  // Current Gemini API response structure:
  // { candidates: [{ content: { parts: [{ text: "..." }], role: "model" }, finishReason: "STOP" }] }
  let text: string | undefined

  try {
    if (Array.isArray(json?.candidates) && json.candidates.length > 0) {
      const cand = json.candidates[0]
      
      // Modern Gemini API: content.parts[].text
      if (cand && typeof cand === 'object') {
        const c = cand as Record<string, unknown>
        if (c.content && typeof c.content === 'object') {
          const content = c.content as Record<string, unknown>
          if (Array.isArray(content.parts)) {
            text = content.parts
              .map((p: unknown) => {
                if (p && typeof p === 'object') {
                  const part = p as Record<string, unknown>
                  return typeof part.text === 'string' ? part.text : ''
                }
                return ''
              })
              .join('')
          }
        }
      }
      
      // Legacy fallback: output field
      if (!text && typeof cand?.output === 'string') {
        text = cand.output
      }
    }

    // Fallback: top-level text field
    if (!text) {
      text = json?.text
    }
  } catch (_err) {
    // fall through to fallback
    void _err
  }

  if (!text) text = JSON.stringify(json)

  return {
    provider: 'gemini',
    model,
    text,
    raw: json,
  }
}
