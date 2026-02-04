export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { system, message } = req.body

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured')
    return res.status(500).json({ error: 'AI service not configured' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: system || 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: message }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Anthropic API error:', errorData)
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'AI request failed' 
      })
    }

    const data = await response.json()
    const aiResponse = data.content?.[0]?.text || ''

    return res.status(200).json({ response: aiResponse })
  } catch (error) {
    console.error('AI handler error:', error)
    return res.status(500).json({ error: 'Failed to process request' })
  }
}
