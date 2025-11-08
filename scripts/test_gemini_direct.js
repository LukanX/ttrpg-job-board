/**
 * Direct Gemini API test - minimal diagnostic script to identify the correct endpoint
 */
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

async function testEndpoint(url, body, headers) {
  console.log('\n=== Testing endpoint ===')
  console.log('URL:', url.replace(/key=[^&]+/, 'key=***'))
  console.log('Body:', JSON.stringify(body, null, 2))
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    
    console.log('Status:', resp.status, resp.statusText)
    const text = await resp.text()
    
    if (resp.ok) {
      console.log('SUCCESS!')
      try {
        const json = JSON.parse(text)
        console.log('Response:', JSON.stringify(json, null, 2))
      } catch (e) {
        console.log('Response (text):', text)
      }
      return true
    } else {
      console.log('Error response:', text)
      return false
    }
  } catch (err) {
    console.log('Fetch error:', String(err))
    return false
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY
  
  if (!apiKey) {
    console.error('GOOGLE_API_KEY not set in .env')
    process.exit(1)
  }
  
  console.log('API Key found (length:', apiKey.length, ')')
  
  const prompt = 'Say hello in JSON format with a "message" field.'
  
  // Test different endpoint configurations
  const tests = [
    {
      name: 'Gemini 1.5 Flash - generateContent (current API)',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      body: {
        contents: [{
          parts: [{ text: prompt }]
        }]
      }
    },
    {
      name: 'Gemini 2.5 Flash - generateContent',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      body: {
        contents: [{
          parts: [{ text: prompt }]
        }]
      }
    },
    {
      name: 'Gemini Pro - generateContent',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      body: {
        contents: [{
          parts: [{ text: prompt }]
        }]
      }
    },
    {
      name: 'Text Bison - generateText (PaLM API)',
      url: `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${apiKey}`,
      body: {
        prompt: { text: prompt }
      }
    },
  ]
  
  const headers = { 'Content-Type': 'application/json' }
  
  for (const test of tests) {
    console.log('\n' + '='.repeat(60))
    console.log('TEST:', test.name)
    const success = await testEndpoint(test.url, test.body, headers)
    if (success) {
      console.log('\n✓ Found working configuration!')
      break
    }
    await new Promise(r => setTimeout(r, 500))
  }
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
