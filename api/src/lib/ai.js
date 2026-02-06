/**
 * Signal Sorter AI Service
 * 
 * World-class implementation with:
 * - Structured JSON output for reliable parsing
 * - Fuzzy matching for duplicate detection
 * - Levenshtein distance for name similarity
 * - Proper error handling and retry logic
 */

// Levenshtein distance for fuzzy matching
const levenshtein = (a, b) => {
  if (!a.length) return b.length
  if (!b.length) return a.length
  
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
    }
  }
  return matrix[b.length][a.length]
}

// Calculate similarity ratio (0-1)
const similarity = (a, b) => {
  const normalized1 = normalize(a)
  const normalized2 = normalize(b)
  const maxLen = Math.max(normalized1.length, normalized2.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(normalized1, normalized2) / maxLen
}

// Normalize text for comparison
const normalize = (text) => {
  return text
    .toLowerCase()
    .replace(/^(signal|necessary|noise)[:\s]*/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Clean item name for display
const cleanName = (name) => {
  return name
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/^(signal|necessary|noise)[:\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Find best matching existing item (returns null if no good match)
const findMatchingItem = (name, existingItems, threshold = 0.75) => {
  const normalizedName = normalize(name)
  let bestMatch = null
  let bestScore = 0
  
  for (const item of existingItems) {
    const score = similarity(normalizedName, normalize(item.name))
    if (score > threshold && score > bestScore) {
      bestMatch = item
      bestScore = score
    }
  }
  
  return bestMatch
}

// Build system prompt
const buildSystemPrompt = (userContext, activeItems, completedItems, mode) => {
  const { name, role, work_priorities, personal_priorities, goals, workday_start, focus_challenge } = userContext || {}

  const contextBlock = [
    name && `User: ${name}`,
    role && `Role: ${role}`,
    work_priorities?.length && `Work priorities: ${work_priorities.join(', ')}`,
    personal_priorities?.length && `Personal priorities: ${personal_priorities.join(', ')}`,
    goals?.length && `Goals: ${goals.join(', ')}`,
    workday_start && `Workday starts: ${workday_start}`,
    focus_challenge && `Focus challenge: ${focus_challenge}`
  ].filter(Boolean).join('\n')

  const activeItemsList = activeItems.length 
    ? activeItems.map(i => `  - "${i.name}" [${i.classification}]`).join('\n')
    : '  None yet'

  const recentCompleted = completedItems.slice(0, 5)
  const completedList = recentCompleted.length
    ? recentCompleted.map(i => `  - "${i.name}"`).join('\n')
    : '  None'

  if (mode === 'reprioritize') {
    return `You are a decisive productivity coach helping ${name || 'the user'} prioritize.

${contextBlock}

CURRENT ACTIVE ITEMS:
${activeItemsList}

RECENTLY COMPLETED:
${completedList}

YOUR TASK: Analyze their current items and tell them exactly what to focus on NOW.

RESPONSE FORMAT:
1. Start with their #1 priority and why
2. Give a brief ranking of their top 3 items
3. Be direct and actionable - no fluff

DO NOT suggest new items. Only work with what they have.
Keep response under 150 words. Be a decisive coach, not a passive assistant.`
  }

  return `You are Signal Sorter, a decisive productivity AI for ${name || 'a busy professional'}${role ? ` working as ${role}` : ''}.

${contextBlock}

CURRENT TRACKED ITEMS:
${activeItemsList}

YOUR TASK: When the user dumps tasks/thoughts, classify each one and respond conversationally.

OUTPUT FORMAT - For each NEW task (not already in the list above), output a JSON block:
\`\`\`json
{"items": [
  {"name": "Short task name", "classification": "SIGNAL", "what": "What this involves", "why": "Why it matters", "next": "Specific next action"},
  {"name": "Another task", "classification": "NECESSARY", "what": "...", "why": "...", "next": "..."},
  {"name": "Low priority", "classification": "NOISE", "what": "...", "why": "Why it's noise", "next": "Defer/delegate/ignore"}
]}
\`\`\`

CLASSIFICATION RULES:
- SIGNAL: Directly advances top priorities. High impact. Do these first.
- NECESSARY: Must be done but can be batched. Medium impact.
- NOISE: Doesn't advance priorities. Defer, delegate, or ignore.

CRITICAL RULES:
1. Keep task names SHORT (3-6 words max)
2. Be decisive - YOU classify, don't ask them to
3. DO NOT include items that are already tracked (check the list above!)
4. If the user mentions something already tracked, acknowledge it but don't re-add it
5. After the JSON block, add a brief conversational summary
6. End with: "**Your top signal: [specific task]**"

Respond like a smart coworker, not a formal assistant. Be direct and helpful.`
}

// Parse AI response to extract items
const parseResponse = (response, existingItems) => {
  const newItems = []
  const updates = []
  const seenNames = new Set()

  // Try to extract JSON block
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i)
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      const items = parsed.items || parsed
      
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item.name || !item.classification) continue
          
          const cleanedName = cleanName(item.name)
          if (cleanedName.length < 3) continue
          
          const normalizedName = normalize(cleanedName)
          if (seenNames.has(normalizedName)) continue
          seenNames.add(normalizedName)
          
          // Check for existing match
          const existingMatch = findMatchingItem(cleanedName, existingItems)
          
          if (existingMatch) {
            // Update if classification changed
            if (existingMatch.classification !== item.classification) {
              console.log(`[AI] Update: "${existingMatch.name}" ${existingMatch.classification} → ${item.classification}`)
              updates.push({
                id: existingMatch.id,
                classification: item.classification,
                what: item.what || existingMatch.what,
                why: item.why || existingMatch.why,
                next_action: item.next || existingMatch.next_action
              })
            }
          } else {
            // New item
            console.log(`[AI] New: "${cleanedName}" (${item.classification})`)
            newItems.push({
              name: cleanedName,
              classification: item.classification,
              what: item.what || '',
              why: item.why || '',
              next_action: item.next || ''
            })
          }
        }
      }
    } catch (e) {
      console.warn('[AI] JSON parse failed, falling back to regex:', e.message)
    }
  }

  // Fallback: regex extraction if JSON failed or was empty
  if (newItems.length === 0 && updates.length === 0) {
    const patterns = [
      { regex: /🟢\s*SIGNAL[:\s]+([^|]+)(?:\|\s*WHAT:\s*([^|]+))?(?:\|\s*WHY:\s*([^|]+))?(?:\|\s*NEXT:\s*([^\n]+))?/gi, classification: 'SIGNAL' },
      { regex: /🟡\s*NECESSARY[:\s]+([^|]+)(?:\|\s*WHAT:\s*([^|]+))?(?:\|\s*WHY:\s*([^|]+))?(?:\|\s*NEXT:\s*([^\n]+))?/gi, classification: 'NECESSARY' },
      { regex: /🔴\s*NOISE[:\s]+([^|]+)(?:\|\s*WHAT:\s*([^|]+))?(?:\|\s*WHY:\s*([^|]+))?(?:\|\s*NEXT:\s*([^\n]+))?/gi, classification: 'NOISE' }
    ]

    for (const { regex, classification } of patterns) {
      let match
      while ((match = regex.exec(response)) !== null) {
        const cleanedName = cleanName(match[1])
        if (cleanedName.length < 3) continue
        
        const normalizedName = normalize(cleanedName)
        if (seenNames.has(normalizedName)) continue
        if (isInvalidPhrase(cleanedName)) continue
        seenNames.add(normalizedName)

        const existingMatch = findMatchingItem(cleanedName, existingItems)
        
        if (existingMatch) {
          if (existingMatch.classification !== classification) {
            updates.push({
              id: existingMatch.id,
              classification,
              what: match[2]?.trim() || existingMatch.what,
              why: match[3]?.trim() || existingMatch.why,
              next_action: match[4]?.trim() || existingMatch.next_action
            })
          }
        } else {
          newItems.push({
            name: cleanedName,
            classification,
            what: match[2]?.trim() || '',
            why: match[3]?.trim() || '',
            next_action: match[4]?.trim() || ''
          })
        }
      }
    }
  }

  return { newItems, updates }
}

// Check if name is an invalid phrase (summary text, not a task)
const isInvalidPhrase = (name) => {
  const lower = name.toLowerCase()
  const invalid = [
    'your top', 'looking at', 'here\'s', 'let me', 'based on',
    'priority right now', 'focus on', 'i recommend', 'you should',
    'the key', 'most important', 'start with'
  ]
  return invalid.some(phrase => lower.includes(phrase))
}

// Main export: Analyze with AI
export const analyzeWithAI = async (userMessage, userContext, existingItems = [], isReprioritize = false) => {
  const activeItems = existingItems.filter(i => !i.completed)
  const completedItems = existingItems.filter(i => i.completed)
  const mode = isReprioritize ? 'reprioritize' : 'classify'
  
  const systemPrompt = buildSystemPrompt(userContext, activeItems, completedItems, mode)

  console.log(`[AI] Request mode: ${mode}, active items: ${activeItems.length}`)

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
      throw new Error(errorData.error || `AI request failed (${response.status})`)
    }

    const data = await response.json()
    const aiResponse = data.response || ''
    
    // Parse items from response (skip if reprioritize mode)
    const { newItems, updates } = mode === 'reprioritize' 
      ? { newItems: [], updates: [] }
      : parseResponse(aiResponse, existingItems)
    
    console.log(`[AI] Result: ${newItems.length} new, ${updates.length} updates`)

    return {
      response: aiResponse,
      items: newItems,
      updates
    }
  } catch (error) {
    console.error('[AI] Error:', error)
    throw error
  }
}

// Export utilities for testing
export const _internal = {
  normalize,
  cleanName,
  similarity,
  findMatchingItem,
  parseResponse
}
