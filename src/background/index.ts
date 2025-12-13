import type { MessageRequest, MessageResponse, Workspace } from '@/types'
import { getAllTabsWithMetadata } from './tabManager'

console.log('Intent Tab Organizer: Service worker initialized')

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Intent Tab Organizer installed')
    // Initialize storage with empty workspaces
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

    // Return true to indicate async response
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

    default:
      return { success: false, error: 'Unknown message type' }
  }
}

async function analyzeTabs(): Promise<MessageResponse> {
  try {
    // Get all tabs with enriched metadata (description, OG tags, content snippet)
    const tabs = await getAllTabsWithMetadata()

    console.log(`Analyzed ${tabs.length} tabs with metadata`)

    return {
      success: true,
      data: {
        tabs,
        message: 'Tab analysis complete with metadata',
      },
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

    // Mark as saved and add to storage
    const workspaceToSave = { ...workspace, isSaved: true }
    savedWorkspaces.push(workspaceToSave)

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

    // Create a new window with all the workspace tabs
    const window = await chrome.windows.create({ focused: true })

    // Open each tab in the new window
    for (const tab of workspace.tabs) {
      await chrome.tabs.create({
        windowId: window.id,
        url: tab.url,
      })
    }

    // Close the initial empty tab that comes with new window
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
