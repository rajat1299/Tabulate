# Intent-Aware Tab Organizer - Build Reference

## Project Overview

A Chrome Extension (Manifest V3) that uses AI to organize browser tabs by **user intent** rather than domain. Built with React, TypeScript, and Claude API.

**Core Value Proposition:** Transforms 15+ messy tabs into organized workspaces like "Berlin Trip Planning", "Q4 Strategy Work", "Keyboard Research" with summaries and actionable insights.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Build Tool | Vite + @crxjs/vite-plugin |
| State Management | Zustand |
| AI Integration | Claude API (claude-sonnet-4-20250514) |
| Icons | lucide-react |
| ID Generation | uuid |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  [Popup UI] <──> [Service Worker] <──> [LLM API]       │
│   (React)        (Background)        (Anthropic)       │
│      │                │                                │
│      ▼                ▼                                │
│  [Content Scripts] [Chrome Storage]                    │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
intent-tab-organizer/
├── manifest.json
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── TabNav.tsx
│   │       ├── WorkspaceCard.tsx
│   │       ├── WorkspaceList.tsx
│   │       ├── SavedWorkspaces.tsx
│   │       └── LoadingState.tsx
│   ├── background/
│   │   ├── index.ts           # Service worker entry
│   │   ├── tabManager.ts      # Chrome tabs API wrapper
│   │   ├── llmService.ts      # Claude API integration
│   │   └── storageService.ts  # chrome.storage wrapper
│   ├── content/
│   │   └── index.ts           # Metadata extraction
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── shared/
│       ├── constants.ts
│       └── utils.ts
└── public/
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---

## Data Models (TypeScript Interfaces)

```typescript
// src/types/index.ts

interface TabData {
  id: number;              // Chrome tab ID
  url: string;             // Full URL
  title: string;           // Page title
  domain: string;          // Extracted domain
  favicon: string;         // Favicon URL
  description?: string;    // Meta description
  ogTags?: {
    title?: string;
    description?: string;
    type?: string;
    image?: string;
  };
  contentSnippet?: string; // First 500 chars (optional)
  lastAccessed: number;    // Timestamp
}

interface Workspace {
  id: string;              // UUID
  name: string;            // AI-generated display name
  summary: string;         // AI-generated 1-2 sentence summary
  tabs: TabData[];         // Tabs in this workspace
  keyEntities: string[];   // Dates, prices, names, deadlines
  suggestedActions?: string[];  // Next steps
  confidence: number;      // 0-1 clustering confidence
  createdAt: number;       // Timestamp
  isSaved: boolean;        // User saved this workspace
}

interface ClusteringResult {
  workspaces: {
    name: string;
    tabIds: number[];
    summary: string;
    keyEntities: string[];
    suggestedActions: string[];
    confidence: number;
  }[];
  unclustered: number[];   // Tab IDs that didn't fit any cluster
}

// Message types for popup <-> service worker communication
type MessageType =
  | { type: 'ANALYZE_TABS' }
  | { type: 'SAVE_WORKSPACE'; payload: Workspace }
  | { type: 'GET_SAVED_WORKSPACES' }
  | { type: 'DELETE_WORKSPACE'; payload: string }
  | { type: 'RESTORE_WORKSPACE'; payload: string }
  | { type: 'GET_TAB_METADATA'; payload: number };
```

---

## Chrome APIs Required

| API | Purpose |
|-----|---------|
| `chrome.tabs` | Query, create, update, move tabs |
| `chrome.tabGroups` | Create native Chrome tab groups |
| `chrome.storage.local` | Persist saved workspaces |
| `chrome.scripting` | Inject content scripts for metadata |
| `chrome.windows` | Create new windows for workspaces |
| `chrome.runtime` | Message passing between components |

---

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Intent-Aware Tab Organizer",
  "version": "1.0.0",
  "description": "AI-powered tab organization by intent, not domain",
  "permissions": [
    "tabs",
    "tabGroups",
    "storage",
    "scripting",
    "activeTab"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## LLM Integration

### Configuration
- **Model:** `claude-sonnet-4-20250514`
- **Max Tokens:** 2048
- **Temperature:** 0.3 (low for consistent structured output)

### System Prompt
```
You are an intelligent tab organizer. Analyze browser tabs and group them by user INTENT, not just domain.

Guidelines:
- Group by task/project, not website
- Minimum 2 tabs per workspace (single tabs stay unclustered)
- Use clear, human-readable workspace names
- Extract key entities: dates, prices, names, deadlines
- Suggest 1-2 actionable next steps per workspace
- Confidence score 0-1 based on how well tabs relate

Return ONLY valid JSON matching this schema:
{
  "workspaces": [
    {
      "name": "Workspace Name",
      "tabIds": [1, 2, 3],
      "summary": "1-2 sentence description",
      "keyEntities": ["Jan 15-22", "$450/night"],
      "suggestedActions": ["Book hotel", "Check visa requirements"],
      "confidence": 0.85
    }
  ],
  "unclustered": [4, 5]
}
```

### User Prompt Template
```
Analyze these browser tabs and group by user intent:

${JSON.stringify(tabData, null, 2)}

Group these tabs into meaningful workspaces based on what the user is trying to accomplish.
```

---

## UI Specifications

### Popup Dimensions
- **Width:** 400px
- **Height:** 600px

### Layout Structure
```
┌─────────────────────────────────────┐
│ Header (60px)                       │
│ Logo | Settings | Tab Count         │
├─────────────────────────────────────┤
│ Tab Nav (40px)                      │
│ [Organize] [Saved Workspaces]       │
├─────────────────────────────────────┤
│                                     │
│ Main Content (460px)                │
│ - Workspace Cards (scrollable)      │
│                                     │
├─────────────────────────────────────┤
│ Footer (40px)                       │
│ Stats / Status                      │
└─────────────────────────────────────┘
```

### Workspace Card Design
```
┌────────────────────────────────────┐
│ 🏨 Berlin Trip Planning    4 tabs ▼│
├────────────────────────────────────┤
│ Planning trip to Berlin. Flights   │
│ Jan 15-22, hotels near Mitte...    │
├────────────────────────────────────┤
│ Key: Jan 15-22 | $450/night        │
├────────────────────────────────────┤
│  [Save Workspace]  [Dismiss]       │
└────────────────────────────────────┘
```

### Design Tokens
```css
:root {
  --color-primary: #6366f1;      /* Indigo - buttons, links */
  --color-background: #fafafa;   /* Light gray - popup bg */
  --color-surface: #ffffff;      /* White - cards */
  --color-text-primary: #1a1a2e; /* Dark - headings */
  --color-text-secondary: #64748b; /* Gray - descriptions */
  --color-success: #10b981;      /* Green - high confidence */
  --color-warning: #f59e0b;      /* Amber - medium confidence */
  --color-border: #e2e8f0;       /* Light border */
  --font-family: 'Inter', system-ui, sans-serif;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Setup) ✅ COMPLETE
- [x] Initialize Vite + React + TypeScript project
- [x] Configure @crxjs/vite-plugin for Chrome extension
- [x] Create manifest.json with all permissions
- [x] Set up Tailwind CSS
- [x] Create basic popup with header, tab nav, main content, footer
- [x] Create service worker with message handlers
- [x] Implement message passing between popup and service worker
- [x] Wire up Analyze Tabs button to fetch and display tabs
- [x] Verify extension builds successfully

**Deliverable:** Extension loads, popup opens, lists tabs ✅

### Phase 2: Data Extraction ✅ COMPLETE
- [x] Implement `tabManager.ts` - dedicated module for tab operations
- [x] Metadata extraction via chrome.scripting.executeScript (no manifest content script)
  - [x] Title, URL, domain extraction
  - [x] Meta description extraction
  - [x] Open Graph tags (og:title, og:description, og:type, og:image)
  - [x] Content snippet (only when meta/OG missing - optimized)
- [x] Build `TabData` aggregation pipeline (enrich tabs with metadata)
- [x] Handle edge cases:
  - [x] Protected pages (chrome://, about:, extensions)
  - [x] Tabs that fail metadata extraction (graceful fallback)
  - [x] Tab readiness gating (only extract from status="complete")
  - [x] Timeout protection (3s per tab)
- [x] Use Chrome's lastAccessed timestamp (not Date.now())
- [x] Enhanced UI to display extracted metadata (expandable tab cards)
- [x] Fixed line-clamp CSS utilities

**Code Review Fixes Applied:**
- Removed duplicate manifest content script (using executeScript only)
- Removed dead GET_TAB_METADATA message type
- Conditional snippet extraction (only when no meta/OG description)
- Batch size increased to 10 with timeout protection
- Tab readiness check before metadata extraction

**Deliverable:** Can extract rich metadata from all open tabs ✅

### Phase 3: AI Integration ✅ COMPLETE
- [x] Create `llmService.ts` with OpenRouter SDK (using Claude via OpenRouter)
- [x] Implement clustering prompt with system/user messages
- [x] Parse JSON response into `ClusteringResult` with validation
- [x] Handle API errors gracefully (auth, rate limit, timeout)
- [x] Build loading state UI ("Analyzing your tabs...")
- [x] Create `WorkspaceCard` component with expand/collapse
- [x] Display clustering results with confidence scores
- [x] API key management (settings panel, storage)
- [x] Save/dismiss workspace actions
- [x] Saved workspaces view with restore/delete

**Deliverable:** Analyze tabs and show AI-suggested workspaces ✅

### Phase 4: Persistence & Polish
- [x] Storage via chrome.storage.local (in background/index.ts)
- [x] Save workspace functionality
- [x] Saved workspaces tab/view
- [x] Restore workspace (opens tabs in new window)
- [x] Delete workspace
- [ ] Create Chrome tab groups for saved workspaces
- [ ] UI polish and animations
- [ ] Demo preparation

**Deliverable:** Fully functional, demo-ready prototype

---

## Key User Flows

### Flow 1: Organize Tabs
1. User clicks extension icon
2. Popup shows "Analyzing X tabs..." with spinner
3. Service worker queries all tabs, extracts metadata
4. Sends to Claude API for clustering
5. Displays workspace cards with:
   - Workspace name + tab count
   - Summary
   - Key entities (expandable)
   - Confidence indicator
6. User expands card to see individual tabs
7. User clicks "Save Workspace" or "Dismiss"

### Flow 2: Restore Workspace
1. User navigates to "Saved Workspaces" tab
2. Sees list of saved workspaces
3. Clicks "Restore" on a workspace
4. Tabs reopen (in new window or current)
5. Optional: Creates Chrome tab group

---

## Edge Cases to Handle

| Scenario | Handling |
|----------|----------|
| Single tab | Don't create workspace, show in "unclustered" |
| All same domain | Still try to cluster by intent (10 YouTube tabs might be different topics) |
| Protected pages | Skip chrome://, about://, extension pages |
| 100+ tabs | Consider pagination or batching API calls |
| API rate limit | Show error, allow retry |
| API timeout | 30s timeout, show error |
| Duplicate tabs | Deduplicate by URL |
| Tab closed during analysis | Handle gracefully, filter out |

---

## Test Scenarios

1. **Trip Planning:** 4 tabs (flights, hotels, activities, maps)
   - Expected: "Berlin Trip Planning" cluster with dates/prices

2. **Mixed Work/Personal:** Work docs + shopping tabs
   - Expected: Separate workspaces

3. **Research:** arXiv + GitHub + StackOverflow on same topic
   - Expected: "ML Research" or similar cluster

4. **Edge - Few Tabs:** Only 2-3 tabs
   - Expected: Either one workspace or unclustered

5. **Edge - Many Tabs:** 50+ tabs
   - Expected: Multiple distinct workspaces, reasonable performance

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "uuid": "^9.0.0",
    "lucide-react": "^0.300.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## API Key Handling

For prototype/demo purposes:
- Store API key in `chrome.storage.local` (set via options page or hardcoded for demo)
- In production: Would need secure backend proxy

---

## Demo Script (5-7 min)

1. **The Problem (30s):** Show browser with 20+ messy tabs, can't see favicons
2. **Magic Moment (2min):** Click extension, watch analysis, reveal organized workspaces
3. **Explore Intelligence (2min):** Expand cards, show cross-site grouping, key entities
4. **Save & Organize (1min):** Save a workspace, show it in saved tab, restore it
5. **Why This Matters (1min):** "Only a browser can do this. Built in a week."

---

## Future Enhancements (Out of Scope for Prototype)

- Auto-clustering when tab count exceeds threshold
- Workspace templates
- Cross-device sync
- Smart suggestions ("You often work on X on Mondays...")
- Integration with browser bookmarks
- Keyboard shortcuts
