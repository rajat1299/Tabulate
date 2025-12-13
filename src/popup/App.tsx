import { useState, useEffect } from 'react'
import { Layers, BookmarkPlus, Settings } from 'lucide-react'

type TabView = 'organize' | 'saved'

function App() {
  const [activeTab, setActiveTab] = useState<TabView>('organize')
  const [tabCount, setTabCount] = useState(0)

  useEffect(() => {
    // Get current tab count
    chrome.tabs.query({}, (tabs) => {
      setTabCount(tabs.length)
    })
  }, [])

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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Layers className="w-12 h-12 text-text-muted mb-4" />
            <h2 className="text-lg font-medium text-text-primary mb-2">
              Ready to Organize
            </h2>
            <p className="text-sm text-text-secondary mb-6 max-w-[280px]">
              Click the button below to analyze your tabs and group them by intent.
            </p>
            <button className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors">
              Analyze Tabs
            </button>
          </div>
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

export default App
