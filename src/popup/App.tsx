import { useState, useEffect } from 'react'
import { Layers, BookmarkPlus, Settings, Loader2, Globe, RefreshCw } from 'lucide-react'
import type { TabData, MessageResponse } from '@/types'

type TabView = 'organize' | 'saved'
type AnalysisStatus = 'idle' | 'loading' | 'complete' | 'error'

interface AnalysisState {
  status: AnalysisStatus
  tabs: TabData[]
  error?: string
}

function App() {
  const [activeTab, setActiveTab] = useState<TabView>('organize')
  const [tabCount, setTabCount] = useState(0)
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: 'idle',
    tabs: [],
  })

  useEffect(() => {
    chrome.tabs.query({}, (tabs) => {
      setTabCount(tabs.length)
    })
  }, [])

  const handleAnalyzeTabs = async () => {
    setAnalysis({ status: 'loading', tabs: [] })

    try {
      const response: MessageResponse<{ tabs: TabData[]; message: string }> =
        await chrome.runtime.sendMessage({ type: 'ANALYZE_TABS' })

      if (response.success) {
        setAnalysis({
          status: 'complete',
          tabs: response.data.tabs,
        })
      } else {
        setAnalysis({
          status: 'error',
          tabs: [],
          error: response.error,
        })
      }
    } catch (err) {
      setAnalysis({
        status: 'error',
        tabs: [],
        error: err instanceof Error ? err.message : 'Failed to analyze tabs',
      })
    }
  }

  const handleReset = () => {
    setAnalysis({ status: 'idle', tabs: [] })
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
          <button className="p-1.5 hover:bg-background rounded-md transition-colors">
            <Settings className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      </header>

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
          Saved Workspaces
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'organize' ? (
          <OrganizeView
            analysis={analysis}
            onAnalyze={handleAnalyzeTabs}
            onReset={handleReset}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookmarkPlus className="w-12 h-12 text-text-muted mb-4" />
            <h2 className="text-lg font-medium text-text-primary mb-2">
              No Saved Workspaces
            </h2>
            <p className="text-sm text-text-secondary max-w-[280px]">
              Save workspaces from the Organize tab to access them here.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center h-[40px] bg-surface border-t border-border">
        <p className="text-xs text-text-muted">
          Powered by Claude AI
        </p>
      </footer>
    </div>
  )
}

interface OrganizeViewProps {
  analysis: AnalysisState
  onAnalyze: () => void
  onReset: () => void
}

function OrganizeView({ analysis, onAnalyze, onReset }: OrganizeViewProps) {
  if (analysis.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="w-10 h-10 text-primary mb-4 animate-spin" />
        <h2 className="text-lg font-medium text-text-primary mb-2">
          Analyzing your tabs...
        </h2>
        <p className="text-sm text-text-secondary">
          Extracting metadata and preparing for AI clustering
        </p>
      </div>
    )
  }

  if (analysis.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-lg font-medium text-text-primary mb-2">
          Analysis Failed
        </h2>
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
            Found {analysis.tabs.length} tabs
          </h2>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {analysis.tabs.map((tab) => (
            <TabItem key={tab.id} tab={tab} />
          ))}
        </div>
        <div className="pt-3 mt-3 border-t border-border">
          <p className="text-xs text-text-muted text-center">
            Phase 2: AI clustering will group these by intent
          </p>
        </div>
      </div>
    )
  }

  // Idle state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Layers className="w-12 h-12 text-text-muted mb-4" />
      <h2 className="text-lg font-medium text-text-primary mb-2">
        Ready to Organize
      </h2>
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

interface TabItemProps {
  tab: TabData
}

function TabItem({ tab }: TabItemProps) {
  return (
    <div className="flex items-center gap-3 p-2.5 bg-surface rounded-lg border border-border hover:border-primary/30 transition-colors">
      {tab.favicon ? (
        <img
          src={tab.favicon}
          alt=""
          className="w-5 h-5 rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
      ) : null}
      <Globe
        className={`w-5 h-5 text-text-muted flex-shrink-0 ${tab.favicon ? 'hidden' : ''}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {tab.title}
        </p>
        <p className="text-xs text-text-secondary truncate">{tab.domain}</p>
      </div>
    </div>
  )
}

export default App
