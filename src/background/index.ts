import type { MessageRequest, MessageResponse, Workspace, TabData } from '@/types'
import { getAllTabsWithMetadata } from './tabManager'
import { clusterTabs, setApiKey, hasApiKey } from './llmService'
import { v4 as uuidv4 } from 'uuid'

console.log('Intent Tab Organizer: Service worker initialized')

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Intent Tab Organizer installed')
    chrome.storage.local.set({ savedWorkspaces: [] })
  }
})

// Message handler for popup communication
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    handleMessage(request)
      .then(sendResponse)
      .catch((error) => {
        console.error('Message handler error:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true
  }
)

async function handleMessage(request: MessageRequest): Promise<MessageResponse> {
  switch (request.type) {
    case 'ANALYZE_TABS':
      return await analyzeTabs()

    case 'SAVE_WORKSPACE':
      return await saveWorkspace(request.payload)

    case 'GET_SAVED_WORKSPACES':
      return await getSavedWorkspaces()

    case 'DELETE_WORKSPACE':
      return await deleteWorkspace(request.payload)

    case 'RESTORE_WORKSPACE':
      return await restoreWorkspace(request.payload)

    case 'SET_API_KEY':
      return await handleSetApiKey(request.payload)

    case 'HAS_API_KEY':
      return await handleHasApiKey()

    default:
      return { success: false, error: 'Unknown message type' }
  }
}

async function handleSetApiKey(apiKey: string): Promise<MessageResponse> {
  try {
    await setApiKey(apiKey)
    return { success: true, data: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save API key',
    }
  }
}

async function handleHasApiKey(): Promise<MessageResponse> {
  try {
    const hasKey = await hasApiKey()
    return { success: true, data: hasKey }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check API key',
    }
  }
}

interface AnalysisResult {
  workspaces: Workspace[]
  unclustered: TabData[]
}

async function analyzeTabs(): Promise<MessageResponse<AnalysisResult>> {
  try {
    // Get all tabs with enriched metadata
    const tabs = await getAllTabsWithMetadata()
    console.log(`Found ${tabs.length} tabs with metadata`)

    if (tabs.length === 0) {
      return {
        success: true,
        data: { workspaces: [], unclustered: [] },
      }
    }

    // Cluster tabs using LLM
    const clusterResult = await clusterTabs(tabs)
    console.log(`LLM returned ${clusterResult.workspaces.length} workspaces`)

    // Build tab lookup map
    const tabMap = new Map(tabs.map((t) => [t.id, t]))

    // Convert clustering result to Workspace objects
    const workspaces: Workspace[] = clusterResult.workspaces.map((cluster) => ({
      id: uuidv4(),
      name: cluster.name,
      summary: cluster.summary,
      tabs: cluster.tabIds
        .map((id) => tabMap.get(id))
        .filter((t): t is TabData => t !== undefined),
      keyEntities: cluster.keyEntities,
      suggestedActions: cluster.suggestedActions,
      confidence: cluster.confidence,
      createdAt: Date.now(),
      isSaved: false,
    }))

    // Get unclustered tabs
    const unclustered = clusterResult.unclustered
      .map((id) => tabMap.get(id))
      .filter((t): t is TabData => t !== undefined)

    return {
      success: true,
      data: { workspaces, unclustered },
    }
  } catch (error) {
    console.error('Error analyzing tabs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze tabs',
    }
  }
}

async function saveWorkspace(workspace: Workspace): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get('savedWorkspaces')
    const savedWorkspaces: Workspace[] = result.savedWorkspaces || []

    const workspaceToSave = { ...workspace, isSaved: true }

    const existingIndex = savedWorkspaces.findIndex((w) => w.id === workspace.id)
    if (existingIndex >= 0) {
      savedWorkspaces[existingIndex] = workspaceToSave
    } else {
      savedWorkspaces.push(workspaceToSave)
    }

    await chrome.storage.local.set({ savedWorkspaces })

    return { success: true, data: workspaceToSave }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save workspace',
    }
  }
}

async function getSavedWorkspaces(): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get('savedWorkspaces')
    return { success: true, data: result.savedWorkspaces || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workspaces',
    }
  }
}

async function deleteWorkspace(workspaceId: string): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get('savedWorkspaces')
    const savedWorkspaces: Workspace[] = result.savedWorkspaces || []

    const filtered = savedWorkspaces.filter((w) => w.id !== workspaceId)
    await chrome.storage.local.set({ savedWorkspaces: filtered })

    return { success: true, data: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete workspace',
    }
  }
}

async function restoreWorkspace(workspaceId: string): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get('savedWorkspaces')
    const savedWorkspaces: Workspace[] = result.savedWorkspaces || []

    const workspace = savedWorkspaces.find((w) => w.id === workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const window = await chrome.windows.create({ focused: true })

    for (const tab of workspace.tabs) {
      await chrome.tabs.create({
        windowId: window.id,
        url: tab.url,
      })
    }

    if (window.tabs && window.tabs.length > 0) {
      await chrome.tabs.remove(window.tabs[0].id!)
    }

    return { success: true, data: workspace }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore workspace',
    }
  }
}

export {}
