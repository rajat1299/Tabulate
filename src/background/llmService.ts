import { OpenRouter } from '@openrouter/sdk'
import type { TabData, ClusteringResult } from '@/types'

// Model to use for clustering
const MODEL = 'anthropic/claude-sonnet-4'

const SYSTEM_PROMPT = `You are an intelligent tab organizer. Analyze browser tabs and group them by user INTENT, not just domain.

Guidelines:
- Group by task/project, not website
- Minimum 2 tabs per workspace (single tabs go to unclustered)
- Use clear, human-readable workspace names (e.g., "Berlin Trip Planning", "Q4 Strategy Work")
- Extract key entities: dates, prices, names, deadlines
- Suggest 1-2 actionable next steps per workspace
- Confidence score 0-1 based on how well tabs relate

Return ONLY valid JSON matching this exact schema:
{
  "workspaces": [
    {
      "name": "Workspace Name",
      "tabIds": [1, 2, 3],
      "summary": "1-2 sentence description of what user is trying to accomplish",
      "keyEntities": ["Jan 15-22", "$450/night", "Berlin"],
      "suggestedActions": ["Book hotel", "Check visa requirements"],
      "confidence": 0.85
    }
  ],
  "unclustered": [4, 5]
}

Important:
- tabIds must be the exact numeric IDs from the input
- Every input tab ID must appear exactly once (either in a workspace or unclustered)
- Do not invent or hallucinate tab IDs`

/**
 * Get the OpenRouter API key from storage
 */
async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get('openRouterApiKey')
  return result.openRouterApiKey || null
}

/**
 * Set the OpenRouter API key in storage
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ openRouterApiKey: apiKey })
}

/**
 * Check if API key is configured
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey()
  return !!key
}

/**
 * Format tabs for the LLM prompt
 */
function formatTabsForPrompt(tabs: TabData[]): string {
  const simplified = tabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    domain: tab.domain,
    description: tab.description || tab.ogTags?.description || tab.contentSnippet?.slice(0, 200),
  }))

  return JSON.stringify(simplified, null, 2)
}

/**
 * Parse and validate the LLM response
 */
function parseClusteringResponse(
  responseText: string,
  inputTabIds: number[]
): ClusteringResult {
  // Try to extract JSON from the response
  let jsonStr = responseText.trim()

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  const parsed = JSON.parse(jsonStr)

  // Validate structure
  if (!parsed.workspaces || !Array.isArray(parsed.workspaces)) {
    throw new Error('Invalid response: missing workspaces array')
  }

  // Validate all tab IDs are accounted for
  const usedIds = new Set<number>()
  for (const ws of parsed.workspaces) {
    if (!ws.tabIds || !Array.isArray(ws.tabIds)) {
      throw new Error(`Invalid workspace: missing tabIds`)
    }
    for (const id of ws.tabIds) {
      if (usedIds.has(id)) {
        throw new Error(`Duplicate tab ID: ${id}`)
      }
      usedIds.add(id)
    }
  }

  const unclustered = parsed.unclustered || []
  for (const id of unclustered) {
    if (usedIds.has(id)) {
      throw new Error(`Tab ID ${id} appears in both workspace and unclustered`)
    }
    usedIds.add(id)
  }

  // Check for missing IDs and add them to unclustered
  const missingIds = inputTabIds.filter((id) => !usedIds.has(id))
  if (missingIds.length > 0) {
    console.warn('LLM missed some tab IDs, adding to unclustered:', missingIds)
    unclustered.push(...missingIds)
  }

  return {
    workspaces: parsed.workspaces.map((ws: {
      name: string
      tabIds: number[]
      summary: string
      keyEntities?: string[]
      suggestedActions?: string[]
      confidence?: number
    }) => ({
      name: ws.name || 'Unnamed Workspace',
      tabIds: ws.tabIds,
      summary: ws.summary || '',
      keyEntities: ws.keyEntities || [],
      suggestedActions: ws.suggestedActions || [],
      confidence: typeof ws.confidence === 'number' ? ws.confidence : 0.5,
    })),
    unclustered,
  }
}

/**
 * Cluster tabs using OpenRouter LLM
 */
export async function clusterTabs(tabs: TabData[]): Promise<ClusteringResult> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Please set your API key in settings.')
  }

  if (tabs.length === 0) {
    return { workspaces: [], unclustered: [] }
  }

  if (tabs.length === 1) {
    return { workspaces: [], unclustered: [tabs[0].id] }
  }

  const client = new OpenRouter({
    apiKey,
  })

  const userPrompt = `Analyze these browser tabs and group by user intent:

${formatTabsForPrompt(tabs)}

Group these ${tabs.length} tabs into meaningful workspaces based on what the user is trying to accomplish. Remember: return ONLY valid JSON.`

  try {
    const response = await client.chat.send({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    })

    const messageContent = response.choices[0]?.message?.content
    if (!messageContent) {
      throw new Error('Empty response from LLM')
    }

    // Handle content that could be string or array
    const content = typeof messageContent === 'string'
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.map((item) => 'text' in item ? item.text : '').join('')
        : String(messageContent)

    const tabIds = tabs.map((t) => t.id)
    return parseClusteringResponse(content, tabIds)
  } catch (error) {
    console.error('LLM clustering error:', error)

    if (error instanceof Error) {
      // Re-throw with more context
      if (error.message.includes('401') || error.message.includes('auth')) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.')
      }
      if (error.message.includes('429') || error.message.includes('rate')) {
        throw new Error('Rate limit exceeded. Please try again in a moment.')
      }
      throw error
    }

    throw new Error('Failed to cluster tabs. Please try again.')
  }
}
