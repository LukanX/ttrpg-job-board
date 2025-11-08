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
    const responseBody: any = {
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

    const data = await response.json()

    // Extract text from Responses API structure
    let text = ''
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              text += contentItem.text
            }
          }
        }
      }
    }

    // Fallback if no text found
    if (!text) {
      text = JSON.stringify(data)
    }

    return {
      provider: 'openai',
      model,
      text,
      raw: data,
    }
  } else {
    // Standard Chat Completions API for gpt-4, gpt-3.5, etc.
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? '512'),
    })

    // Response parsing: attempt to be robust across client versions
    const text =
      // @ts-ignore
      resp?.choices?.[0]?.message?.content ??
      // @ts-ignore
      resp?.choices?.[0]?.text ??
      String(resp)

    return {
      provider: 'openai',
      model,
      text,
      raw: resp,
    }
  }
}
