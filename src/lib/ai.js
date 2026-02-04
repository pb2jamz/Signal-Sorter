// AI service - calls serverless function to keep API key secure

export const analyzeWithAI = async (userMessage, userContext, existingItems = [], isReprioritize = false) => {
  const activeItems = existingItems.filter(i => !i.completed)
  const completedItems = existingItems.filter(i => i.completed)

  const systemPrompt = buildSystemPrompt(userContext, activeItems, completedItems, isReprioritize)

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        message: userMessage
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'AI request failed')
    }

    const data = await response.json()
    return {
      response: data.response,
      items: extractItems(data.response, existingItems)
    }
  } catch (error) {
    console.error('AI Error:', error)
    throw error
  }
}

const buildSystemPrompt = (userContext, activeItems, completedItems, isReprioritize) => {
  const { name, role, work_priorities, personal_priorities, goals, workday_start, focus_challenge } = userContext || {}

  return `You are a Signal vs Noise sorter for ${name || 'a user'}${role ? `, who works as ${role}` : ''}.

${work_priorities?.length ? `Their top work priorities: ${work_priorities.join(', ')}` : ''}
${personal_priorities?.length ? `Their personal priorities: ${personal_priorities.join(', ')}` : ''}
${goals?.length ? `Their goals: ${goals.join(', ')}` : ''}
${workday_start ? `Their workday starts at: ${workday_start}` : ''}
${focus_challenge ? `Their main focus challenge: ${focus_challenge}` : ''}

RULES:
1. When user dumps tasks/thoughts, categorize each using this EXACT format:
   🟢 SIGNAL: [task name] | WHAT: [one sentence] | WHY: [why it matters] | NEXT: [specific next action]
   🟡 NECESSARY: [task name] | WHAT: [one sentence] | WHY: [why it matters] | NEXT: [specific next action]
   🔴 NOISE: [task name] | WHAT: [one sentence] | WHY: [why it's noise] | NEXT: [what to do - ignore/delegate/defer]

2. CRITICAL: Use the pipe | character to separate fields. Keep each field brief (under 15 words).

3. Be direct and decisive. Don't ask them to score things. YOU decide.

4. Keep the conversational summary brief after the categorized items.

5. If they seem overwhelmed, identify their TOP 3 signals only.

6. After sorting, always end with: "Your top signal right now: [specific task]"

${isReprioritize ? `
USER WANTS TO REPRIORITIZE. Current active items:
${activeItems.map(i => `- ${i.name} (${i.classification})`).join('\n') || 'None'}

Recently completed:
${completedItems.slice(0, 5).map(i => `- ${i.name}`).join('\n') || 'None'}

Re-evaluate and tell them what should be #1 priority NOW.
` : `
Current tracked items:
${activeItems.map(i => `- ${i.name} (${i.classification})`).join('\n') || 'None yet'}`}

Respond casually like a coworker, not a formal assistant.`
}

const extractItems = (aiResponse, existingItems) => {
  const extractedItems = []
  const lines = aiResponse.split('\n')

  lines.forEach(line => {
    // Match: 🟢 SIGNAL: Task name | WHAT: x | WHY: y | NEXT: z
    const signalMatch = line.match(/🟢\s*(?:SIGNAL)?[:\s]*([^|]+)\|?\s*WHAT:\s*([^|]+)\|?\s*WHY:\s*([^|]+)\|?\s*NEXT:\s*(.+)/i)
    if (signalMatch) {
      const name = cleanName(signalMatch[1])
      if (isValidItem(name, existingItems)) {
        extractedItems.push({
          name,
          classification: 'SIGNAL',
          what: signalMatch[2]?.trim() || '',
          why: signalMatch[3]?.trim() || '',
          next_action: signalMatch[4]?.trim() || ''
        })
      }
    } else {
      const simpleSignal = line.match(/🟢\s*(?:SIGNAL)?[:\s]*([^-–—|\n]{5,60})(?:\s*[-–—|]|$)/i)
      if (simpleSignal?.[1]) {
        const name = cleanName(simpleSignal[1])
        if (isValidItem(name, existingItems)) {
          extractedItems.push({ name, classification: 'SIGNAL', what: '', why: '', next_action: '' })
        }
      }
    }

    const necessaryMatch = line.match(/🟡\s*(?:NECESSARY)?[:\s]*([^|]+)\|?\s*WHAT:\s*([^|]+)\|?\s*WHY:\s*([^|]+)\|?\s*NEXT:\s*(.+)/i)
    if (necessaryMatch) {
      const name = cleanName(necessaryMatch[1])
      if (isValidItem(name, existingItems)) {
        extractedItems.push({
          name,
          classification: 'NECESSARY',
          what: necessaryMatch[2]?.trim() || '',
          why: necessaryMatch[3]?.trim() || '',
          next_action: necessaryMatch[4]?.trim() || ''
        })
      }
    } else {
      const simpleNecessary = line.match(/🟡\s*(?:NECESSARY)?[:\s]*([^-–—|\n]{5,60})(?:\s*[-–—|]|$)/i)
      if (simpleNecessary?.[1]) {
        const name = cleanName(simpleNecessary[1])
        if (isValidItem(name, existingItems)) {
          extractedItems.push({ name, classification: 'NECESSARY', what: '', why: '', next_action: '' })
        }
      }
    }

    const noiseMatch = line.match(/🔴\s*(?:NOISE)?[:\s]*([^|]+)\|?\s*WHAT:\s*([^|]+)\|?\s*WHY:\s*([^|]+)\|?\s*NEXT:\s*(.+)/i)
    if (noiseMatch) {
      const name = cleanName(noiseMatch[1])
      if (isValidItem(name, existingItems)) {
        extractedItems.push({
          name,
          classification: 'NOISE',
          what: noiseMatch[2]?.trim() || '',
          why: noiseMatch[3]?.trim() || '',
          next_action: noiseMatch[4]?.trim() || ''
        })
      }
    } else {
      const simpleNoise = line.match(/🔴\s*(?:NOISE)?[:\s]*([^-–—|\n]{5,60})(?:\s*[-–—|]|$)/i)
      if (simpleNoise?.[1]) {
        const name = cleanName(simpleNoise[1])
        if (isValidItem(name, existingItems)) {
          extractedItems.push({ name, classification: 'NOISE', what: '', why: '', next_action: '' })
        }
      }
    }
  })

  return extractedItems
}

const cleanName = (name) => {
  return name.trim().replace(/^\*+|\*+$/g, '').replace(/\*\*/g, '').trim()
}

const isValidItem = (name, existingItems) => {
  return (
    name.length >= 5 &&
    !name.toLowerCase().startsWith('your top') &&
    !existingItems.some(i => i.name.toLowerCase() === name.toLowerCase())
  )
}
