import type { MessageRequest, MessageResponse, Workspace, TabData, WorkspaceColor, UserSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import { getAllTabsWithMetadata } from './tabManager'
import { clusterTabs, setApiKey, hasApiKey } from './llmService'
import { v4 as uuidv4 } from 'uuid'

console.log('[Spaces] Service worker initialized at', new Date().toISOString())

// Color rotation for auto-assigning workspace colors
const WORKSPACE_COLORS: WorkspaceColor[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'cyan', 'orange', 'red']
let colorIndex = 0

function getNextColor(): WorkspaceColor {
  const color = WORKSPACE_COLORS[colorIndex % WORKSPACE_COLORS.length]
  colorIndex++
  return color
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Spaces] Extension installed')
    chrome.storage.local.set({
      savedWorkspaces: [],
      settings: DEFAULT_SETTINGS,
    })
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
        console.error('[Spaces] Message handler error:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true
  }
)

async function handleMessage(request: MessageRequest): Promise<MessageResponse> {
  console.log('[Spaces] Received message:', request.type)
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

    case 'GROUP_TABS':
      return await groupTabs(request.payload)

    case 'SET_API_KEY':
      return await handleSetApiKey(request.payload)

    case 'HAS_API_KEY':
      return await handleHasApiKey()

    case 'GET_SETTINGS':
      return await getSettings()

    case 'SET_SETTINGS':
      return await setSettings(request.payload)

    default:
      return { success: false, error: 'Unknown message type' }
  }
}

// Settings management
async function getSettings(): Promise<MessageResponse<UserSettings>> {
  try {
    const result = await chrome.storage.local.get('settings')
    return { success: true, data: result.settings || DEFAULT_SETTINGS }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
    }
  }
}

async function setSettings(settings: Partial<UserSettings>): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get('settings')
    const currentSettings = result.settings || DEFAULT_SETTINGS
    const newSettings = { ...currentSettings, ...settings }
    await chrome.storage.local.set({ settings: newSettings })
    return { success: true, data: newSettings }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings',
    }
  }
}

async function handleSetApiKey(apiKey: string): Promise<MessageResponse> {
  console.log('[Spaces] Setting API key...')
  try {
    await setApiKey(apiKey)
    console.log('[Spaces] API key saved successfully')
    return { success: true, data: null }
  } catch (error) {
    console.error('[Spaces] Failed to save API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save API key',
    }
  }
}

async function handleHasApiKey(): Promise<MessageResponse> {
  console.log('[Spaces] Checking if API key exists...')
  try {
    const hasKey = await hasApiKey()
    console.log('[Spaces] API key exists:', hasKey)
    return { success: true, data: hasKey }
  } catch (error) {
    console.error('[Spaces] Failed to check API key:', error)
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
  console.log('[Spaces] Starting tab analysis...')
  try {
    const tabs = await getAllTabsWithMetadata()
    console.log(`[Spaces] Found ${tabs.length} tabs with metadata`)

    if (tabs.length === 0) {
      return {
        success: true,
        data: { workspaces: [], unclustered: [] },
      }
    }

    console.log('[Spaces] Calling LLM for clustering...')
    const clusterResult = await clusterTabs(tabs)
    console.log(`[Spaces] LLM returned ${clusterResult.workspaces.length} workspaces`)

    const tabMap = new Map(tabs.map((t) => [t.id, t]))

    // Reset color index for fresh analysis
    colorIndex = 0

    const workspaces: Workspace[] = clusterResult.workspaces.map((cluster) => ({
      id: uuidv4(),
      name: cluster.name,
      summary: cluster.summary,
      tabs: cluster.tabIds
        .map((id) => tabMap.get(id))
        .filter((t): t is TabData => t !== undefined),
      keyEntities: cluster.keyEntities || [],
      suggestedActions: cluster.suggestedActions || [],
      confidence: cluster.confidence,
      createdAt: Date.now(),
      isSaved: false,
      color: getNextColor(),
    }))

    const unclustered = clusterResult.unclustered
      .map((id) => tabMap.get(id))
      .filter((t): t is TabData => t !== undefined)

    return {
      success: true,
      data: { workspaces, unclustered },
    }
  } catch (error) {
    console.error('[Spaces] Error analyzing tabs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze tabs',
    }
  }
}

async function saveWorkspace(workspace: Workspace): Promise<MessageResponse> {
  try {
    const result = await chrome.storage.local.get(['savedWorkspaces', 'settings'])
    const savedWorkspaces: Workspace[] = result.savedWorkspaces || []
    const settings: UserSettings = result.settings || DEFAULT_SETTINGS

    const workspaceToSave = {
      ...workspace,
      isSaved: true,
      color: workspace.color || settings.defaultColor,
    }

    const existingIndex = savedWorkspaces.findIndex((w) => w.id === workspace.id)
    if (existingIndex >= 0) {
      savedWorkspaces[existingIndex] = workspaceToSave
    } else {
      savedWorkspaces.push(workspaceToSave)
    }

    await chrome.storage.local.set({ savedWorkspaces })

    // Auto-group tabs if enabled
    if (settings.autoGroupOnSave && workspace.tabs && workspace.tabs.length > 0) {
      const tabIds = workspace.tabs.map(t => t.id).filter(id => id !== undefined)
      if (tabIds.length > 0) {
        try {
          await createTabGroup(tabIds, workspace.name, workspaceToSave.color || 'blue')
        } catch (groupError) {
          console.warn('[Spaces] Could not auto-group tabs:', groupError)
          // Don't fail the save if grouping fails
        }
      }
    }

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

    if (!workspace.tabs || workspace.tabs.length === 0) {
      return { success: false, error: 'Workspace has no tabs' }
    }

    // Create new window
    const window = await chrome.windows.create({ focused: true })
    if (!window.id) {
      return { success: false, error: 'Failed to create window' }
    }

    // Create tabs
    const newTabIds: number[] = []
    for (const tab of workspace.tabs) {
      const newTab = await chrome.tabs.create({
        windowId: window.id,
        url: tab.url,
      })
      if (newTab.id) {
        newTabIds.push(newTab.id)
      }
    }

    // Remove the default blank tab
    if (window.tabs && window.tabs.length > 0 && window.tabs[0].id) {
      await chrome.tabs.remove(window.tabs[0].id)
    }

    // Group the tabs
    if (newTabIds.length > 0) {
      try {
        await createTabGroup(newTabIds, workspace.name, workspace.color || 'blue')
      } catch (groupError) {
        console.warn('[Spaces] Could not group restored tabs:', groupError)
      }
    }

    return { success: true, data: workspace }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore workspace',
    }
  }
}

// Chrome Tab Groups integration
async function groupTabs(payload: { tabIds: number[]; name: string; color: WorkspaceColor }): Promise<MessageResponse> {
  try {
    await createTabGroup(payload.tabIds, payload.name, payload.color)
    return { success: true, data: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to group tabs',
    }
  }
}

async function createTabGroup(tabIds: number[], title: string, color: WorkspaceColor): Promise<number> {
  // Filter to only tabs that still exist
  const existingTabs = await chrome.tabs.query({})
  const existingTabIds = new Set(existingTabs.map(t => t.id))
  const validTabIds = tabIds.filter(id => existingTabIds.has(id))

  if (validTabIds.length === 0) {
    throw new Error('No valid tabs to group')
  }

  // Create the group
  const groupId = await chrome.tabs.group({ tabIds: validTabIds })

  // Update group properties
  await chrome.tabGroups.update(groupId, {
    title,
    color,
    collapsed: false,
  })

  console.log(`[Spaces] Created tab group "${title}" with ${validTabIds.length} tabs`)
  return groupId
}

export {}
