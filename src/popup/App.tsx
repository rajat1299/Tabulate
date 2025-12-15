import { useState, useEffect } from 'react'
import {
  Sparkles,
  Archive,
  Settings2,
  Loader2,
  Globe,
  RotateCcw,
  ChevronRight,
  Check,
  X,
  KeyRound,
  ExternalLink,
  Trash2,
  FolderOpen,
  AlertCircle,
  Plus,
  Minus,
  Sun,
  Moon,
  Layers,
} from 'lucide-react'
import type { TabData, Workspace, MessageResponse, WorkspaceColor, UserSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

type TabView = 'organize' | 'saved'
type Theme = 'light' | 'dark' | 'system'

interface AnalysisState {
  status: 'idle' | 'loading' | 'complete' | 'error' | 'needs-api-key'
  workspaces: Workspace[]
  unclustered: TabData[]
  error?: string
}

// Workspace color definitions
const WORKSPACE_COLORS: { value: WorkspaceColor; label: string; class: string }[] = [
  { value: 'blue', label: 'Blue', class: 'bg-workspace-blue' },
  { value: 'green', label: 'Green', class: 'bg-workspace-green' },
  { value: 'yellow', label: 'Yellow', class: 'bg-workspace-yellow' },
  { value: 'pink', label: 'Pink', class: 'bg-workspace-pink' },
  { value: 'purple', label: 'Purple', class: 'bg-workspace-purple' },
  { value: 'cyan', label: 'Cyan', class: 'bg-workspace-cyan' },
  { value: 'orange', label: 'Orange', class: 'bg-workspace-orange' },
  { value: 'red', label: 'Red', class: 'bg-workspace-red' },
  { value: 'grey', label: 'Grey', class: 'bg-workspace-grey' },
]

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
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [theme, setTheme] = useState<Theme>('light')

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    init()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to analyze
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (analysis.status === 'idle' && hasKey) {
          handleAnalyzeTabs()
        }
      }
      // 1 for Organize tab, 2 for Saved tab
      if (e.key === '1' && !e.metaKey && !e.ctrlKey && !isInputFocused()) {
        setActiveTab('organize')
      }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey && !isInputFocused()) {
        setActiveTab('saved')
      }
      // Escape to close settings
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false)
      }
      // Comma for settings
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowSettings(prev => !prev)
      }
    }

    const isInputFocused = () => {
      const activeElement = document.activeElement
      return activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [analysis.status, hasKey, showSettings])

  const init = async () => {
    try {
      chrome.tabs.query({}, (tabs) => setTabCount(tabs.length))
      await loadSettings()
      await loadSavedWorkspaces()
      await checkApiKey()
    } catch (error) {
      console.error('Init error:', error)
      setInitError(error instanceof Error ? error.message : 'Failed to initialize')
    }
  }

  const loadSettings = async () => {
    const response = await sendMessage<UserSettings>({ type: 'GET_SETTINGS' })
    if (response.success) {
      setSettings(response.data)
      setTheme(response.data.theme)
    }
  }

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const response = await sendMessage<UserSettings>({
      type: 'SET_SETTINGS',
      payload: newSettings,
    })
    if (response.success) {
      setSettings(response.data)
      if (newSettings.theme) {
        setTheme(newSettings.theme)
      }
    }
  }

  const checkApiKey = async () => {
    const response = await sendMessage<boolean>({ type: 'HAS_API_KEY' })
    if (response.success) {
      setHasKey(response.data)
      if (!response.data) {
        setAnalysis((prev) => ({ ...prev, status: 'needs-api-key' }))
      } else {
        setAnalysis((prev) =>
          prev.status === 'needs-api-key' ? { ...prev, status: 'idle' } : prev
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
        setAnalysis({ status: 'needs-api-key', workspaces: [], unclustered: [], error: errorMsg })
        setHasKey(false)
      } else {
        setAnalysis({ status: 'error', workspaces: [], unclustered: [], error: errorMsg })
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

  const handleUpdateWorkspaceColor = (workspaceId: string, color: WorkspaceColor) => {
    setAnalysis((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, color } : w
      ),
    }))
  }

  const handleDismissWorkspace = (workspaceId: string) => {
    setAnalysis((prev) => ({
      ...prev,
      workspaces: prev.workspaces.filter((w) => w.id !== workspaceId),
    }))
  }

  const handleGroupTabs = async (workspace: Workspace) => {
    if (!workspace.tabs || workspace.tabs.length === 0) return
    const tabIds = workspace.tabs.map(t => t.id)
    await sendMessage({
      type: 'GROUP_TABS',
      payload: { tabIds, name: workspace.name, color: workspace.color || 'blue' },
    })
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

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    updateSettings({ theme: newTheme })
  }

  if (initError) {
    return (
      <div className="flex flex-col h-popup w-popup bg-themed-subtle items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full bg-state-error/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-state-error" />
        </div>
        <h2 className="text-base font-medium text-themed mb-1">Something went wrong</h2>
        <p className="text-sm text-themed-secondary text-center mb-5 max-w-[280px]">{initError}</p>
        <button
          onClick={() => { setInitError(null); init(); }}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-popup w-popup bg-themed-subtle ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-13 bg-themed-canvas border-b border-themed">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <span className="text-base font-semibold text-themed tracking-tight">Spaces</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-themed-tertiary font-medium tabular-nums mr-1">{tabCount}</span>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-themed-tertiary hover:text-themed-secondary hover:bg-themed-muted transition-colors"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${
              showSettings
                ? 'bg-accent/10 text-accent'
                : 'text-themed-tertiary hover:text-themed-secondary hover:bg-themed-muted'
            }`}
            title="Settings (⌘,)"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onApiKeySaved={handleApiKeySaved}
          hasExistingKey={hasKey === true}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      )}

      {/* Tab Navigation */}
      <nav className="flex bg-themed-canvas border-b border-themed">
        <TabButton
          active={activeTab === 'organize'}
          onClick={() => setActiveTab('organize')}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Organize"
          shortcut="1"
        />
        <TabButton
          active={activeTab === 'saved'}
          onClick={() => setActiveTab('saved')}
          icon={<Archive className="w-3.5 h-3.5" />}
          label="Saved"
          badge={savedWorkspaces.length > 0 ? savedWorkspaces.length : undefined}
          shortcut="2"
        />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'organize' ? (
          <OrganizeView
            analysis={analysis}
            onAnalyze={handleAnalyzeTabs}
            onReset={handleReset}
            onSaveWorkspace={handleSaveWorkspace}
            onDismissWorkspace={handleDismissWorkspace}
            onGroupTabs={handleGroupTabs}
            onUpdateColor={handleUpdateWorkspaceColor}
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
    </div>
  )
}

// Tab Button
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  shortcut,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative group ${
        active ? 'text-themed' : 'text-themed-tertiary hover:text-themed-secondary'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-themed-muted text-2xs font-medium text-themed-secondary flex items-center justify-center">
          {badge}
        </span>
      )}
      {shortcut && (
        <kbd className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">{shortcut}</kbd>
      )}
      {active && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent rounded-full" />
      )}
    </button>
  )
}

// Settings Panel
interface SettingsPanelProps {
  onClose: () => void
  onApiKeySaved: () => void
  hasExistingKey: boolean
  settings: UserSettings
  onUpdateSettings: (settings: Partial<UserSettings>) => void
}

function SettingsPanel({ onClose, onApiKeySaved, hasExistingKey, settings, onUpdateSettings }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setStatus('saving')
    setErrorMsg('')

    const response = await sendMessage<null>({
      type: 'SET_API_KEY',
      payload: apiKey.trim(),
    })

    if (response.success) {
      setStatus('saved')
      setApiKey('')
      onApiKeySaved()
      setTimeout(onClose, 800)
    } else {
      setStatus('error')
      setErrorMsg(response.error || 'Failed to save')
    }
  }

  return (
    <div className="p-4 bg-themed-canvas border-b border-themed animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-themed">Settings</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-themed-muted text-themed-tertiary hover:text-themed-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-group toggle */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-themed">
        <div>
          <p className="text-sm font-medium text-themed">Auto-group on save</p>
          <p className="text-xs text-themed-tertiary">Create Chrome tab group when saving</p>
        </div>
        <button
          onClick={() => onUpdateSettings({ autoGroupOnSave: !settings.autoGroupOnSave })}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            settings.autoGroupOnSave ? 'bg-accent' : 'bg-themed-muted'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.autoGroupOnSave ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* API Key section */}
      {hasExistingKey && (
        <div className="mb-3 py-2 px-2.5 bg-state-success/10 rounded-lg flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-state-success/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-state-success" />
          </div>
          <span className="text-xs text-state-success font-medium">API key configured</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-themed-secondary font-medium">
          {hasExistingKey ? 'Update API Key' : 'OpenRouter API Key'}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-themed-tertiary" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="sk-or-..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-themed-subtle border border-themed rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 placeholder:text-themed-tertiary"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={status === 'saving' || !apiKey.trim()}
            className="px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed min-w-[64px] flex items-center justify-center"
          >
            {status === 'saved' ? (
              <Check className="w-4 h-4" />
            ) : status === 'saving' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save'
            )}
          </button>
        </div>
        {status === 'error' && (
          <p className="text-xs text-state-error">{errorMsg}</p>
        )}
        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-themed-tertiary hover:text-accent transition-colors"
        >
          Get an API key <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Keyboard shortcuts */}
      <div className="mt-4 pt-4 border-t border-themed">
        <p className="text-xs font-medium text-themed-tertiary mb-2">Keyboard shortcuts</p>
        <div className="space-y-1.5 text-xs text-themed-secondary">
          <div className="flex justify-between">
            <span>Analyze tabs</span>
            <span><kbd>⌘</kbd> <kbd>↵</kbd></span>
          </div>
          <div className="flex justify-between">
            <span>Toggle settings</span>
            <span><kbd>⌘</kbd> <kbd>,</kbd></span>
          </div>
          <div className="flex justify-between">
            <span>Switch tabs</span>
            <span><kbd>1</kbd> <kbd>2</kbd></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Organize View
interface OrganizeViewProps {
  analysis: AnalysisState
  onAnalyze: () => void
  onReset: () => void
  onSaveWorkspace: (workspace: Workspace) => void
  onDismissWorkspace: (id: string) => void
  onGroupTabs: (workspace: Workspace) => void
  onUpdateColor: (id: string, color: WorkspaceColor) => void
  onOpenSettings: () => void
}

function OrganizeView({
  analysis,
  onAnalyze,
  onReset,
  onSaveWorkspace,
  onDismissWorkspace,
  onGroupTabs,
  onUpdateColor,
  onOpenSettings,
}: OrganizeViewProps) {
  if (analysis.status === 'needs-api-key') {
    return (
      <EmptyState
        icon={<KeyRound className="w-5 h-5" />}
        title="API key required"
        description="Add your OpenRouter API key to start organizing tabs with AI."
        action={{ label: 'Add API key', onClick: onOpenSettings }}
      />
    )
  }

  if (analysis.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="relative mb-5">
          <div className="w-12 h-12 rounded-full border-2 border-themed" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-themed mb-1">Analyzing tabs...</p>
        <p className="text-xs text-themed-tertiary">Grouping by intent</p>
      </div>
    )
  }

  if (analysis.status === 'error') {
    return (
      <EmptyState
        icon={<AlertCircle className="w-5 h-5" />}
        title="Analysis failed"
        description={analysis.error || 'Something went wrong. Please try again.'}
        action={{ label: 'Retry', onClick: onAnalyze }}
        variant="error"
      />
    )
  }

  if (analysis.status === 'complete') {
    const hasResults = analysis.workspaces.length > 0 || analysis.unclustered.length > 0

    if (!hasResults) {
      return (
        <EmptyState
          icon={<FolderOpen className="w-5 h-5" />}
          title="No tabs to organize"
          description="Open some tabs and try again."
          action={{ label: 'Analyze again', onClick: onAnalyze }}
        />
      )
    }

    return (
      <div className="h-full flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-themed bg-themed-canvas">
          <span className="text-xs font-medium text-themed-secondary">
            {analysis.workspaces.length} workspace{analysis.workspaces.length !== 1 ? 's' : ''} found
          </span>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-themed-tertiary hover:text-themed-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {analysis.workspaces.map((workspace, index) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onSave={() => onSaveWorkspace(workspace)}
              onDismiss={() => onDismissWorkspace(workspace.id)}
              onGroup={() => onGroupTabs(workspace)}
              onColorChange={(color) => onUpdateColor(workspace.id, color)}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
          {analysis.unclustered.length > 0 && (
            <UnclusteredSection tabs={analysis.unclustered} />
          )}
        </div>
      </div>
    )
  }

  // Idle state
  return (
    <EmptyState
      icon={<Sparkles className="w-5 h-5" />}
      title="Ready to organize"
      description="Analyze your open tabs and group them by what you're working on."
      action={{ label: 'Analyze tabs', onClick: onAnalyze }}
      hint="⌘ + Enter"
    />
  )
}

// Empty State
function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  hint,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  variant?: 'default' | 'error'
  hint?: string
}) {
  const iconBg = variant === 'error' ? 'bg-state-error/10' : 'bg-themed-muted'
  const iconColor = variant === 'error' ? 'text-state-error' : 'text-themed-secondary'

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mb-4`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <h2 className="text-base font-medium text-themed mb-1">{title}</h2>
      <p className="text-sm text-themed-secondary mb-5 max-w-[260px] text-balance">{description}</p>
      {action && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            {action.label}
          </button>
          {hint && <span className="text-2xs text-themed-tertiary">{hint}</span>}
        </div>
      )}
    </div>
  )
}

// Color Picker
function ColorPicker({
  selected,
  onChange,
}: {
  selected: WorkspaceColor
  onChange: (color: WorkspaceColor) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {WORKSPACE_COLORS.map((color) => (
        <button
          key={color.value}
          onClick={(e) => { e.stopPropagation(); onChange(color.value); }}
          className={`w-5 h-5 rounded-full ${color.class} transition-transform hover:scale-110 ${
            selected === color.value ? 'ring-2 ring-offset-2 ring-themed' : ''
          }`}
          title={color.label}
        />
      ))}
    </div>
  )
}

// Workspace Card
interface WorkspaceCardProps {
  workspace: Workspace
  onSave: () => void
  onDismiss: () => void
  onGroup: () => void
  onColorChange: (color: WorkspaceColor) => void
  style?: React.CSSProperties
}

function WorkspaceCard({ workspace, onSave, onDismiss, onGroup, onColorChange, style }: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const tabCount = workspace.tabs?.length ?? 0
  const color = workspace.color || 'blue'

  const colorClass = WORKSPACE_COLORS.find(c => c.value === color)?.class || 'bg-workspace-blue'

  return (
    <div
      className="bg-themed-canvas rounded-xl shadow-soft dark:shadow-soft-dark border border-themed overflow-hidden animate-slide-up"
      style={style}
    >
      {/* Color bar */}
      <div className={`h-1 ${colorClass}`} />

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-themed-subtle transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-themed truncate">{workspace.name}</h3>
          <p className="text-xs text-themed-tertiary">{tabCount} tab{tabCount !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-themed-tertiary transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Summary */}
      <div className="px-3 pb-2.5">
        <p className="text-xs text-themed-secondary leading-relaxed line-clamp-2">{workspace.summary}</p>
      </div>

      {/* Key Entities */}
      {workspace.keyEntities && workspace.keyEntities.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap gap-1">
          {workspace.keyEntities.slice(0, 3).map((entity, i) => (
            <span
              key={i}
              className="text-2xs px-1.5 py-0.5 bg-accent/10 text-accent font-medium rounded"
            >
              {entity}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-themed animate-fade-in">
          {/* Color picker */}
          <div className="mb-3">
            <p className="text-2xs font-medium text-themed-tertiary uppercase tracking-wide mb-1.5">Color</p>
            <ColorPicker selected={color} onChange={onColorChange} />
          </div>

          {/* Tabs list */}
          <div className="space-y-1 mb-3">
            {(workspace.tabs || []).map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-themed-subtle transition-colors group"
              >
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm" />
                ) : (
                  <Globe className="w-4 h-4 text-themed-tertiary" />
                )}
                <span className="text-xs text-themed-secondary truncate flex-1 group-hover:text-themed transition-colors">
                  {tab.title}
                </span>
              </div>
            ))}
          </div>

          {workspace.suggestedActions && workspace.suggestedActions.length > 0 && (
            <div className="pt-2 border-t border-themed">
              <p className="text-2xs font-medium text-themed-tertiary uppercase tracking-wide mb-1.5">
                Suggested
              </p>
              <ul className="space-y-0.5">
                {workspace.suggestedActions.map((action, i) => (
                  <li key={i} className="text-xs text-themed-secondary flex items-start gap-1.5">
                    <span className="text-themed-tertiary mt-0.5">→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-themed">
        <button
          onClick={(e) => { e.stopPropagation(); onGroup(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-themed-secondary hover:text-accent hover:bg-accent/5 transition-colors"
          title="Group tabs in browser"
        >
          <Layers className="w-3.5 h-3.5" />
          Group
        </button>
        <div className="w-px bg-themed" />
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          disabled={workspace.isSaved}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed
            text-themed-secondary hover:text-accent hover:bg-accent/5 disabled:text-themed-tertiary disabled:hover:bg-transparent"
        >
          {workspace.isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-state-success" />
              <span className="text-state-success">Saved</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Save
            </>
          )}
        </button>
        <div className="w-px bg-themed" />
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-themed-tertiary hover:text-state-error hover:bg-state-error/5 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  )
}

// Unclustered Section
function UnclusteredSection({ tabs }: { tabs: TabData[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2 pt-3 border-t border-themed">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-xs font-medium text-themed-tertiary hover:text-themed-secondary transition-colors"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        Unclustered ({tabs.length})
      </button>
      {expanded && (
        <div className="space-y-0.5 animate-fade-in">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-themed-muted transition-colors"
            >
              {tab.favicon ? (
                <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-themed-tertiary" />
              )}
              <span className="text-xs text-themed-secondary truncate">{tab.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Saved Workspaces View
interface SavedWorkspacesViewProps {
  workspaces: Workspace[]
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}

function SavedWorkspacesView({ workspaces, onDelete, onRestore }: SavedWorkspacesViewProps) {
  if (workspaces.length === 0) {
    return (
      <EmptyState
        icon={<Archive className="w-5 h-5" />}
        title="No saved workspaces"
        description="Save workspaces from the Organize tab to access them here."
      />
    )
  }

  return (
    <div className="p-3 space-y-2">
      {workspaces.map((workspace, index) => (
        <SavedWorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onDelete={() => onDelete(workspace.id)}
          onRestore={() => onRestore(workspace.id)}
          style={{ animationDelay: `${index * 50}ms` }}
        />
      ))}
    </div>
  )
}

// Saved Workspace Card
function SavedWorkspaceCard({
  workspace,
  onDelete,
  onRestore,
  style,
}: {
  workspace: Workspace
  onDelete: () => void
  onRestore: () => void
  style?: React.CSSProperties
}) {
  const tabCount = workspace.tabs?.length ?? 0
  const color = workspace.color || 'blue'
  const colorClass = WORKSPACE_COLORS.find(c => c.value === color)?.class || 'bg-workspace-blue'

  return (
    <div
      className="bg-themed-canvas rounded-xl shadow-soft dark:shadow-soft-dark border border-themed overflow-hidden animate-slide-up"
      style={style}
    >
      <div className={`h-1 ${colorClass}`} />
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-themed truncate mb-0.5">{workspace.name}</h3>
            <p className="text-xs text-themed-tertiary">{tabCount} tab{tabCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-0.5 ml-2">
            <button
              onClick={onRestore}
              className="p-1.5 rounded-lg hover:bg-accent/10 text-themed-tertiary hover:text-accent transition-colors"
              title="Restore tabs"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-state-error/10 text-themed-tertiary hover:text-state-error transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-themed-secondary line-clamp-2 mb-2.5">{workspace.summary}</p>

        <div className="flex flex-wrap gap-1">
          {(workspace.tabs || []).slice(0, 5).map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-themed-muted rounded text-2xs text-themed-tertiary"
              title={tab.title}
            >
              {tab.favicon ? (
                <img src={tab.favicon} alt="" className="w-3 h-3 rounded-sm" />
              ) : (
                <Globe className="w-3 h-3" />
              )}
              <span className="truncate max-w-[60px]">{tab.domain}</span>
            </div>
          ))}
          {tabCount > 5 && (
            <span className="text-2xs text-themed-tertiary px-1.5 py-0.5">
              +{tabCount - 5}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
