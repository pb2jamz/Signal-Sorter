// AI service - calls serverless function to keep API key secure

export const analyzeWithAI = async (userMessage, userContext, existingItems = [], isReprioritize = false) => {
  const activeItems = existingItems.filter(i => !i.completed)
  const completedItems = existingItems.filter(i => i.completed)

  const systemPrompt = buildSystemPrompt(userContext, activeItems, completedItems, isReprioritize)

  try {
    console.log('[AI] Sending request...')
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
    console.log('[AI] Response received')
    
    const { newItems, updates } = extractItems(data.response, existingItems)
    console.log('[AI] New items:', newItems.length, '| Updates:', updates.length)
    
    return {
      response: data.response,
      items: newItems,
      updates: updates
    }
  } catch (error) {
    console.error('[AI] Error:', error)
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

2. CRITICAL: 
   - Use the pipe | character to separate fields
   - Keep task names SHORT (3-6 words max)
   - Do NOT include "SIGNAL:", "NECESSARY:", or "NOISE:" in the task name itself
   - Example: "🟢 SIGNAL: Review budget report" NOT "🟢 SIGNAL: SIGNAL: Review budget report"

3. Be direct and decisive. Don't ask them to score things. YOU decide.

4. Keep the conversational summary brief after the categorized items.

5. If they seem overwhelmed, identify their TOP 3 signals only.

6. After sorting, always end with: **Your top signal right now: [specific task]**

${isReprioritize ? `
USER WANTS TO REPRIORITIZE. Current active items:
${activeItems.map(i => `- ${i.name} (${i.classification})`).join('\n') || 'None'}

Recently completed:
${completedItems.slice(0, 5).map(i => `- ${i.name}`).join('\n') || 'None'}

Re-evaluate their existing items based on current context. Tell them what should be #1 priority NOW.
Do NOT create new items - just advise on priority order of existing items.
` : `
Current tracked items:
${activeItems.map(i => `- ${i.name} (${i.classification})`).join('\n') || 'None yet'}`}

Respond casually like a coworker, not a formal assistant.`
}

const extractItems = (aiResponse, existingItems) => {
  const newItems = []
  const updates = []
  const lines = aiResponse.split('\n')
  
  // Create normalized lookup of existing items
  const existingMap = new Map()
  existingItems.forEach(item => {
    existingMap.set(normalizeName(item.name), item)
  })

  lines.forEach(line => {
    let match, classification, name, what, why, next_action
    
    // SIGNAL - full format
    match = line.match(/🟢\s*SIGNAL[:\s]+([^|]+)\|\s*WHAT:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*NEXT:\s*(.+)/i)
    if (match) {
      classification = 'SIGNAL'
      name = cleanName(match[1])
      what = match[2]?.trim() || ''
      why = match[3]?.trim() || ''
      next_action = match[4]?.trim() || ''
    }
    
    // SIGNAL - simple format
    if (!match) {
      match = line.match(/🟢\s*SIGNAL[:\s]+([^|\n]+)/i)
      if (match) {
        classification = 'SIGNAL'
        name = cleanName(match[1])
        what = ''
        why = ''
        next_action = ''
      }
    }

    // NECESSARY - full format
    if (!match) {
      match = line.match(/🟡\s*NECESSARY[:\s]+([^|]+)\|\s*WHAT:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*NEXT:\s*(.+)/i)
      if (match) {
        classification = 'NECESSARY'
        name = cleanName(match[1])
        what = match[2]?.trim() || ''
        why = match[3]?.trim() || ''
        next_action = match[4]?.trim() || ''
      }
    }
    
    // NECESSARY - simple format
    if (!match) {
      match = line.match(/🟡\s*NECESSARY[:\s]+([^|\n]+)/i)
      if (match) {
        classification = 'NECESSARY'
        name = cleanName(match[1])
        what = ''
        why = ''
        next_action = ''
      }
    }

    // NOISE - full format
    if (!match) {
      match = line.match(/🔴\s*NOISE[:\s]+([^|]+)\|\s*WHAT:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*NEXT:\s*(.+)/i)
      if (match) {
        classification = 'NOISE'
        name = cleanName(match[1])
        what = match[2]?.trim() || ''
        why = match[3]?.trim() || ''
        next_action = match[4]?.trim() || ''
      }
    }
    
    // NOISE - simple format
    if (!match) {
      match = line.match(/🔴\s*NOISE[:\s]+([^|\n]+)/i)
      if (match) {
        classification = 'NOISE'
        name = cleanName(match[1])
        what = ''
        why = ''
        next_action = ''
      }
    }

    // If we found a match, process it
    if (match && name && name.length >= 3) {
      const normalizedName = normalizeName(name)
      
      // Check if this item already exists
      const existingItem = existingMap.get(normalizedName)
      
      if (existingItem) {
        // Update existing item if classification changed
        if (existingItem.classification !== classification) {
          console.log(`[AI] Updating "${name}": ${existingItem.classification} -> ${classification}`)
          updates.push({
            id: existingItem.id,
            classification,
            what: what || existingItem.what,
            why: why || existingItem.why,
            next_action: next_action || existingItem.next_action
          })
        }
      } else {
        // Check if we already added this as a new item
        const alreadyAdded = newItems.some(i => normalizeName(i.name) === normalizedName)
        
        if (!alreadyAdded && isValidNewItem(name)) {
          console.log(`[AI] New item: "${name}" (${classification})`)
          newItems.push({
            name,
            classification,
            what,
            why,
            next_action
          })
        }
      }
    }
  })

  return { newItems, updates }
}

// Clean the task name - remove prefixes, asterisks, extra whitespace
const cleanName = (name) => {
  return name
    .trim()
    .replace(/^\*+|\*+$/g, '')  // Remove asterisks
    .replace(/\*\*/g, '')       // Remove bold markers
    .replace(/^(SIGNAL|NECESSARY|NOISE)[:\s]*/i, '')  // Remove classification prefix
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim()
}

// Normalize name for comparison (lowercase, no punctuation)
const normalizeName = (name) => {
  return cleanName(name)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')    // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim()
}

// Check if this is a valid new item (not a summary phrase)
const isValidNewItem = (name) => {
  const lower = name.toLowerCase()
  const invalidPhrases = [
    'your top',
    'looking at',
    'here\'s',
    'let me',
    'based on',
    'priority right now',
    'focus on'
  ]
  return !invalidPhrases.some(phrase => lower.includes(phrase))
}
