export type GenerateOptions = {
  model?: string
  temperature?: number
  maxTokens?: number
}

export type GenerateResult = {
  provider: string
  model?: string
  text: string
  raw?: unknown
}

export type ProviderName = 'openai' | 'gemini'

import * as openaiAdapter from './openai'
import * as geminiAdapter from './gemini'

export async function generateJob(
  provider: ProviderName,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  if (provider === 'openai') {
    return openaiAdapter.generateJobOpenAI(prompt, options)
  }

  if (provider === 'gemini') {
    return geminiAdapter.generateJobGemini(prompt, options)
  }

  throw new Error(`Unsupported provider: ${provider}`)
}
