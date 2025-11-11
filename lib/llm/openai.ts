import OpenAI from 'openai'
import type { GenerateOptions, GenerateResult } from './provider'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  // Do not throw at import time in case this module is loaded in non-llm contexts.
}

export async function generateJobOpenAI(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI adapter')
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Best-effort call; model name is configurable via options or env
  // Default to gpt-4o-mini for reliability and cost-effectiveness
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'

  // Detect if this is a gpt-5 model which uses the Responses API
  const isGpt5 = typeof model === 'string' && model.toLowerCase().includes('gpt-5')

  if (isGpt5) {
    // Use Responses API for gpt-5 models
    // Note: gpt-5 models don't support custom temperature or standard chat completions
    const responseBody: Record<string, unknown> = {
      model,
      input: prompt,
      // gpt-5 uses max_output_tokens and needs higher values to produce visible output (not just reasoning)
      max_output_tokens: options.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? '2000'),
      // Request text output explicitly
      text: {
        format: { type: 'text' }
      }
    }

    // Make raw fetch call since OpenAI SDK may not have Responses API support yet
    const apiKey = process.env.OPENAI_API_KEY
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(responseBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI Responses API failed ${response.status}: ${errorText}`)
    }

    const data: unknown = await response.json()

    // Extract text from Responses API structure using defensive checks
    let text = ''
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      const output = d.output
      if (Array.isArray(output)) {
        for (const item of output) {
          if (item && typeof item === 'object') {
            const it = item as Record<string, unknown>
            if (it.type === 'message' && Array.isArray(it.content)) {
              for (const contentItem of it.content) {
                if (contentItem && typeof contentItem === 'object') {
                  const ci = contentItem as Record<string, unknown>
                  if (ci.type === 'output_text' && typeof ci.text === 'string') {
                    text += ci.text
                  }
                }
              }
            }
          }
        }
      }
    }

    // Fallback if no text found
    if (!text) {
      try {
        text = JSON.stringify(data)
      } catch {
        text = String(data)
      }
    }

    return {
      provider: 'openai',
      model,
      text,
      raw: data,
    }
  } else {
    // Standard Chat Completions API for gpt-4, gpt-3.5, etc.
    const resp: unknown = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? '2000'),
      response_format: { type: 'json_object' },
    })

    // Response parsing: attempt to be robust across client versions
    let text = ''
    if (resp && typeof resp === 'object') {
      const r = resp as Record<string, unknown>
      const choices = Array.isArray(r.choices) ? (r.choices as unknown[]) : undefined
      if (choices && choices.length > 0) {
        const first = choices[0]
        if (first && typeof first === 'object') {
          const f = first as Record<string, unknown>
          // new SDK may have message.content as string
          if (f.message && typeof f.message === 'object') {
            const msg = f.message as Record<string, unknown>
            if (typeof msg.content === 'string') {
              text = msg.content
            }
          }
          // older responses may have text property on the choice
          if (!text && typeof f.text === 'string') {
            text = f.text
          }
        }
      }
    }

    if (!text) text = String(resp)

    return {
      provider: 'openai',
      model,
      text,
      raw: resp,
    }
  }
}
