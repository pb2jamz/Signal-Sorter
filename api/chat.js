/**
 * Signal Sorter Chat API
 * 
 * Secure serverless function for Anthropic Claude API calls
 * - Uses Claude 3.5 Sonnet for optimal quality/speed/cost balance
 * - Implements retry logic for transient failures
 * - Proper error handling and logging
 */

const MAX_RETRIES = 2
const RETRY_DELAY = 1000

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callAnthropic(apiKey, system, message, attempt = 1) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: system || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: message }]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    
    // Retry on transient errors
    if (response.status >= 500 && attempt <= MAX_RETRIES) {
      console.log(`[API] Retry ${attempt}/${MAX_RETRIES} after ${response.status}`)
      await sleep(RETRY_DELAY * attempt)
      return callAnthropic(apiKey, system, message, attempt + 1)
    }
    
    throw new Error(errorData.error?.message || `API error: ${response.status}`)
  }

  return response.json()
}

export default async function handler(req, res) {
  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { system, message } = req.body

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error('[API] ANTHROPIC_API_KEY not configured')
    return res.status(500).json({ error: 'AI service not configured' })
  }

  try {
    console.log('[API] Processing request...')
    
    const data = await callAnthropic(apiKey, system, message)
    const aiResponse = data.content?.[0]?.text || ''

    if (!aiResponse) {
      console.warn('[API] Empty response from Claude')
      return res.status(500).json({ error: 'Empty response from AI' })
    }

    console.log('[API] Success, response length:', aiResponse.length)
    return res.status(200).json({ response: aiResponse })
    
  } catch (error) {
    console.error('[API] Error:', error.message)
    return res.status(500).json({ 
      error: error.message || 'Failed to process request' 
    })
  }
}
