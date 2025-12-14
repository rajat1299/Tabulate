import { useState, useEffect } from 'react'
import {
  Layers,
  BookmarkPlus,
  Settings,
  Loader2,
  Globe,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Key,
  ExternalLink,
  Trash2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import type { TabData, Workspace, MessageResponse } from '@/types'

type TabView = 'organize' | 'saved'

interface AnalysisState {
  status: 'idle' | 'loading' | 'complete' | 'error' | 'needs-api-key'
  workspaces: Workspace[]
  unclustered: TabData[]
  error?: string
}

// Safe wrapper for chrome.runtime.sendMessage
async function sendMessage<T>(message: unknown): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message)
    return response as MessageResponse<T>
  } catch (error) {
    console.error('sendMessage error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to communicate with extension',
    }
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabView>('organize')
  const [tabCount, setTabCount] = useState(0)
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: 'idle',
    workspaces: [],
    unclustered: [],
  })
  const [savedWorkspaces, setSavedWorkspaces] = useState<Workspace[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    try {
      // Get tab count
      chrome.tabs.query({}, (tabs) => {
        setTabCount(tabs.length)
      })

      // Load saved workspaces
      await loadSavedWorkspaces()

      // Check API key
      await checkApiKey()
    } catch (error) {
      console.error('Init error:', error)
      setInitError(error instanceof Error ? error.message : 'Failed to initialize')
    }
  }

  const checkApiKey = async () => {
    const response = await sendMessage<boolean>({ type: 'HAS_API_KEY' })

    if (response.success) {
      setHasKey(response.data)
      if (!response.data) {
        // No API key - show needs-api-key state
        setAnalysis((prev) => ({ ...prev, status: 'needs-api-key' }))
      } else {
        // Has API key - ensure we're in idle state (not stuck in needs-api-key)
        setAnalysis((prev) =>
          prev.status === 'needs-api-key'
            ? { ...prev, status: 'idle' }
            : prev
        )
      }
    } else {
      console.error('Failed to check API key:', response.error)
      setInitError(response.error)
    }
  }

  const loadSavedWorkspaces = async () => {
    const response = await sendMessage<Workspace[]>({ type: 'GET_SAVED_WORKSPACES' })

    if (response.success) {
      setSavedWorkspaces(response.data)
    } else {
      console.error('Failed to load workspaces:', response.error)
    }
  }

  const handleAnalyzeTabs = async () => {
    setAnalysis({ status: 'loading', workspaces: [], unclustered: [] })

    const response = await sendMessage<{
      workspaces: Workspace[]
      unclustered: TabData[]
    }>({ type: 'ANALYZE_TABS' })

    if (response.success) {
      setAnalysis({
        status: 'complete',
        workspaces: response.data.workspaces,
        unclustered: response.data.unclustered,
      })
    } else {
      const errorMsg = response.error || 'Unknown error'
      if (errorMsg.toLowerCase().includes('api key')) {
        setAnalysis({
          status: 'needs-api-key',
          workspaces: [],
          unclustered: [],
          error: errorMsg,
        })
        setHasKey(false)
      } else {
        setAnalysis({
          status: 'error',
          workspaces: [],
          unclustered: [],
          error: errorMsg,
        })
      }
    }
  }

  const handleSaveWorkspace = async (workspace: Workspace) => {
    const response = await sendMessage<Workspace>({
      type: 'SAVE_WORKSPACE',
      payload: workspace,
    })

    if (response.success) {
      setAnalysis((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) =>
          w.id === workspace.id ? { ...w, isSaved: true } : w
        ),
      }))
      loadSavedWorkspaces()
    }
  }

  const handleDismissWorkspace = (workspaceId: string) => {
    setAnalysis((prev) => ({
      ...prev,
      workspaces: prev.workspaces.filter((w) => w.id !== workspaceId),
    }))
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    await sendMessage({ type: 'DELETE_WORKSPACE', payload: workspaceId })
    loadSavedWorkspaces()
  }

  const handleRestoreWorkspace = async (workspaceId: string) => {
    await sendMessage({ type: 'RESTORE_WORKSPACE', payload: workspaceId })
  }

  const handleReset = () => {
    setAnalysis({ status: 'idle', workspaces: [], unclustered: [] })
  }

  const handleApiKeySaved = async () => {
    await checkApiKey()
  }

  // Show init error
  if (initError) {
    return (
      <div className="flex flex-col h-popup w-popup bg-background items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-medium text-text-primary mb-2">Initialization Error</h2>
        <p className="text-sm text-text-secondary text-center mb-4">{initError}</p>
        <button
          onClick={() => { setInitError(null); init(); }}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-popup w-popup bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-[60px] bg-surface border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-semibold text-text-primary">Tab Organizer</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{tabCount} tabs</span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors ${
              showSettings ? 'bg-primary/10 text-primary' : 'hover:bg-background text-text-secondary'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onApiKeySaved={handleApiKeySaved}
          hasExistingKey={hasKey === true}
        />
      )}

      {/* Tab Navigation */}
      <nav className="flex h-[40px] bg-surface border-b border-border">
        <button
          onClick={() => setActiveTab('organize')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            activeTab === 'organize'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4" />
          Organize
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <BookmarkPlus className="w-4 h-4" />
          Saved ({savedWorkspaces.length})
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'organize' ? (
          <OrganizeView
            analysis={analysis}
            onAnalyze={handleAnalyzeTabs}
            onReset={handleReset}
            onSaveWorkspace={handleSaveWorkspace}
            onDismissWorkspace={handleDismissWorkspace}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <SavedWorkspacesView
            workspaces={savedWorkspaces}
            onDelete={handleDeleteWorkspace}
            onRestore={handleRestoreWorkspace}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center h-[40px] bg-surface border-t border-border">
        <p className="text-xs text-text-muted">Powered by AI via OpenRouter</p>
      </footer>
    </div>
  )
}

interface SettingsPanelProps {
  onClose: () => void
  onApiKeySaved: () => void
  hasExistingKey: boolean
}

function SettingsPanel({ onClose, onApiKeySaved, hasExistingKey }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async () => {
    if (!apiKey.trim()) return

    setSaving(true)
    setStatus('saving')
    setErrorMsg('')

    const response = await sendMessage<null>({
      type: 'SET_API_KEY',
      payload: apiKey.trim(),
    })

    setSaving(false)

    if (response.success) {
      setStatus('saved')
      setApiKey('')
      onApiKeySaved()
      setTimeout(() => {
        onClose()
      }, 1000)
    } else {
      setStatus('error')
      setErrorMsg(response.error || 'Failed to save API key')
    }
  }

  return (
    <div className="p-4 bg-surface border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">Settings</h3>
        <button onClick={onClose} className="p-1 hover:bg-background rounded">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {hasExistingKey && (
        <div className="mb-3 p-2 bg-success/10 border border-success/20 rounded-md">
          <p className="text-xs text-success flex items-center gap-1">
            <Check className="w-3 h-3" />
            API key is configured
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          {hasExistingKey ? 'Update API Key' : 'OpenRouter API Key'}
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="px-3 py-2 bg-primary text-white text-sm font-medium rounded-md disabled:opacity-50 min-w-[60px]"
          >
            {status === 'saved' ? (
              <Check className="w-4 h-4 mx-auto" />
            ) : status === 'saving' ? (
              <Loader2 className="w-4 h-4 mx-auto animate-spin" />
            ) : (
              'Save'
            )}
          </button>
        </div>

        {status === 'error' && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}

        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Get API key <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

interface OrganizeViewProps {
  analysis: AnalysisState
  onAnalyze: () => void
  onReset: () => void
  onSaveWorkspace: (workspace: Workspace) => void
  onDismissWorkspace: (id: string) => void
  onOpenSettings: () => void
}

function OrganizeView({
  analysis,
  onAnalyze,
  onReset,
  onSaveWorkspace,
  onDismissWorkspace,
  onOpenSettings,
}: OrganizeViewProps) {
  if (analysis.status === 'needs-api-key') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Key className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-medium text-text-primary mb-2">API Key Required</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-[280px]">
          Please configure your OpenRouter API key to enable AI-powered tab organization.
        </p>
        <button
          onClick={onOpenSettings}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Configure API Key
        </button>
      </div>
    )
  }

  if (analysis.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="w-10 h-10 text-primary mb-4 animate-spin" />
        <h2 className="text-lg font-medium text-text-primary mb-2">Analyzing your tabs...</h2>
        <p className="text-sm text-text-secondary">AI is clustering tabs by intent</p>
      </div>
    )
  }

  if (analysis.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <X className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-medium text-text-primary mb-2">Analysis Failed</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-[280px]">
          {analysis.error || 'An unexpected error occurred'}
        </p>
        <button
          onClick={onAnalyze}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (analysis.status === 'complete') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-primary">
            {analysis.workspaces.length} workspace
            {analysis.workspaces.length !== 1 ? 's' : ''} found
          </h2>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {analysis.workspaces.length === 0 && analysis.unclustered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted">No tabs to organize</p>
            </div>
          )}
          {analysis.workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onSave={() => onSaveWorkspace(workspace)}
              onDismiss={() => onDismissWorkspace(workspace.id)}
            />
          ))}
          {analysis.unclustered.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-medium text-text-muted mb-2">
                Unclustered ({analysis.unclustered.length})
              </h3>
              <div className="space-y-1">
                {analysis.unclustered.map((tab) => (
                  <div
                    key={tab.id}
                    className="flex items-center gap-2 p-2 bg-surface rounded border border-border/50"
                  >
                    {tab.favicon ? (
                      <img src={tab.favicon} alt="" className="w-4 h-4" />
                    ) : (
                      <Globe className="w-4 h-4 text-text-muted" />
                    )}
                    <span className="text-xs text-text-secondary truncate">{tab.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Idle state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Layers className="w-12 h-12 text-text-muted mb-4" />
      <h2 className="text-lg font-medium text-text-primary mb-2">Ready to Organize</h2>
      <p className="text-sm text-text-secondary mb-6 max-w-[280px]">
        Click the button below to analyze your tabs and group them by intent.
      </p>
      <button
        onClick={onAnalyze}
        className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
      >
        Analyze Tabs
      </button>
    </div>
  )
}

interface WorkspaceCardProps {
  workspace: Workspace
  onSave: () => void
  onDismiss: () => void
}

function WorkspaceCard({ workspace, onSave, onDismiss }: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(false)

  const confidenceColor =
    workspace.confidence >= 0.7
      ? 'text-success'
      : workspace.confidence >= 0.4
        ? 'text-warning'
        : 'text-text-muted'

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-background/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">
            {workspace.name.toLowerCase().includes('trip') || workspace.name.toLowerCase().includes('travel')
              ? '✈️'
              : workspace.name.toLowerCase().includes('work') || workspace.name.toLowerCase().includes('project')
                ? '💼'
                : workspace.name.toLowerCase().includes('research')
                  ? '🔬'
                  : workspace.name.toLowerCase().includes('shopping')
                    ? '🛒'
                    : '📁'}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-text-primary truncate">{workspace.name}</h3>
            <span className="text-xs text-text-muted">{workspace.tabs?.length ?? 0} tabs</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${confidenceColor}`}>
            {Math.round(workspace.confidence * 100)}%
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-3 pb-2">
        <p className="text-xs text-text-secondary line-clamp-2">{workspace.summary}</p>
      </div>

      {/* Key Entities */}
      {workspace.keyEntities && workspace.keyEntities.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {workspace.keyEntities.slice(0, 3).map((entity, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"
            >
              {entity}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2">
          {/* Tabs list */}
          <div className="space-y-1 mb-3">
            {(workspace.tabs || []).map((tab) => (
              <div key={tab.id} className="flex items-center gap-2 p-1.5 bg-background rounded">
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-4 h-4" />
                ) : (
                  <Globe className="w-4 h-4 text-text-muted" />
                )}
                <span className="text-xs text-text-secondary truncate flex-1">{tab.title}</span>
              </div>
            ))}
          </div>

          {/* Suggested Actions */}
          {workspace.suggestedActions && workspace.suggestedActions.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[10px] font-medium text-text-muted uppercase mb-1">
                Suggested Actions
              </h4>
              <ul className="text-xs text-text-secondary space-y-0.5">
                {workspace.suggestedActions.map((action, i) => (
                  <li key={i}>• {action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-border">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSave()
          }}
          disabled={workspace.isSaved}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
        >
          {workspace.isSaved ? (
            <>
              <Check className="w-3.5 h-3.5" /> Saved
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5" /> Save
            </>
          )}
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-text-muted hover:text-text-secondary hover:bg-background transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Dismiss
        </button>
      </div>
    </div>
  )
}

interface SavedWorkspacesViewProps {
  workspaces: Workspace[]
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}

function SavedWorkspacesView({ workspaces, onDelete, onRestore }: SavedWorkspacesViewProps) {
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <BookmarkPlus className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-medium text-text-primary mb-2">No Saved Workspaces</h2>
        <p className="text-sm text-text-secondary max-w-[280px]">
          Save workspaces from the Organize tab to access them here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {workspaces.map((workspace) => (
        <div key={workspace.id} className="bg-surface rounded-lg border border-border p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-sm font-medium text-text-primary">{workspace.name}</h3>
              <span className="text-xs text-text-muted">{workspace.tabs?.length ?? 0} tabs</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onRestore(workspace.id)}
                className="p-1.5 hover:bg-primary/10 rounded transition-colors"
                title="Restore tabs"
              >
                <RotateCcw className="w-4 h-4 text-primary" />
              </button>
              <button
                onClick={() => onDelete(workspace.id)}
                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                title="Delete workspace"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{workspace.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(workspace.tabs || []).slice(0, 4).map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-background rounded text-[10px] text-text-muted"
              >
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3 h-3" />
                ) : (
                  <Globe className="w-3 h-3" />
                )}
                <span className="truncate max-w-[80px]">{tab.domain}</span>
              </div>
            ))}
            {(workspace.tabs?.length ?? 0) > 4 && (
              <span className="text-[10px] text-text-muted px-1.5 py-0.5">
                +{(workspace.tabs?.length ?? 0) - 4} more
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default App
