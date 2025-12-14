// Tab data extracted from browser
export interface TabData {
  id: number;
  url: string;
  title: string;
  domain: string;
  favicon: string;
  description?: string;
  ogTags?: {
    title?: string;
    description?: string;
    type?: string;
    image?: string;
  };
  contentSnippet?: string;
  lastAccessed: number;
}

// Workspace representing a cluster of related tabs
export interface Workspace {
  id: string;
  name: string;
  summary: string;
  tabs: TabData[];
  keyEntities: string[];
  suggestedActions?: string[];
  confidence: number;
  createdAt: number;
  isSaved: boolean;
}

// LLM clustering response
export interface ClusteringResult {
  workspaces: {
    name: string;
    tabIds: number[];
    summary: string;
    keyEntities: string[];
    suggestedActions: string[];
    confidence: number;
  }[];
  unclustered: number[];
}

// Message types for communication between popup and service worker
export type MessageRequest =
  | { type: 'ANALYZE_TABS' }
  | { type: 'SAVE_WORKSPACE'; payload: Workspace }
  | { type: 'GET_SAVED_WORKSPACES' }
  | { type: 'DELETE_WORKSPACE'; payload: string }
  | { type: 'RESTORE_WORKSPACE'; payload: string }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'HAS_API_KEY' };

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// Analysis state for UI
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing'; progress?: string }
  | { status: 'complete'; workspaces: Workspace[]; unclustered: TabData[] }
  | { status: 'error'; message: string };

// Storage schema
export interface StorageSchema {
  savedWorkspaces: Workspace[];
  apiKey?: string;
  settings?: {
    autoGroup: boolean;
    showConfidence: boolean;
  };
}
