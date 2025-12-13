import type { TabData } from '@/types'

// URLs that we cannot inject content scripts into
const PROTECTED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^about:/,
  /^edge:\/\//,
  /^brave:\/\//,
  /^moz-extension:\/\//,
  /^file:\/\//,
  /^view-source:/,
  /^devtools:\/\//,
]

export function isProtectedUrl(url: string): boolean {
  return PROTECTED_URL_PATTERNS.some((pattern) => pattern.test(url))
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}

export interface RawTab {
  id: number
  url: string
  title: string
  favIconUrl?: string
  status: 'unloaded' | 'loading' | 'complete'
  lastAccessed?: number
}

/**
 * Query all accessible tabs from the browser
 */
export async function queryAllTabs(): Promise<RawTab[]> {
  const tabs = await chrome.tabs.query({})

  return tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } => {
      if (!tab.id || !tab.url) return false
      if (isProtectedUrl(tab.url)) return false
      return true
    })
    .map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title || 'Untitled',
      favIconUrl: tab.favIconUrl,
      status: (tab.status as RawTab['status']) || 'complete',
      // Use Chrome's lastAccessed if available, fallback to current time
      lastAccessed: (tab as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed,
    }))
}

interface PageMetadata {
  description?: string
  ogTags?: {
    title?: string
    description?: string
    type?: string
    image?: string
  }
  contentSnippet?: string
}

/**
 * This function runs in the context of the page (injected via executeScript)
 * Only extracts content snippet if no meta/OG description is found
 */
function extractPageMetadata(): PageMetadata {
  // Get meta description
  const metaDescription = document.querySelector('meta[name="description"]')
  const description = metaDescription?.getAttribute('content') || undefined

  // Get Open Graph tags
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content')
  const ogDescription = document
    .querySelector('meta[property="og:description"]')
    ?.getAttribute('content')
  const ogType = document
    .querySelector('meta[property="og:type"]')
    ?.getAttribute('content')
  const ogImage = document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content')

  const ogTags =
    ogTitle || ogDescription || ogType || ogImage
      ? {
          title: ogTitle || undefined,
          description: ogDescription || undefined,
          type: ogType || undefined,
          image: ogImage || undefined,
        }
      : undefined

  // Only extract content snippet if we don't have meta or OG description
  // This avoids expensive innerText computation when not needed
  let contentSnippet: string | undefined
  if (!description && !ogDescription) {
    try {
      const body = document.body
      if (body) {
        const text = body.innerText.replace(/\s+/g, ' ').trim()
        contentSnippet = text.slice(0, 500) || undefined
      }
    } catch {
      // Ignore content extraction errors
    }
  }

  return {
    description,
    ogTags,
    contentSnippet,
  }
}

/**
 * Extract metadata from a single tab using content script injection
 * with timeout protection
 */
async function extractTabMetadata(tabId: number): Promise<PageMetadata | null> {
  try {
    // Create a promise that rejects after timeout
    const timeoutMs = 3000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Metadata extraction timeout')), timeoutMs)
    })

    const extractionPromise = chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageMetadata,
    })

    const results = await Promise.race([extractionPromise, timeoutPromise])

    if (results && results[0]?.result) {
      return results[0].result as PageMetadata
    }
    return null
  } catch (error) {
    // Tab might be protected, not accessible, or timed out
    console.warn(`Failed to extract metadata from tab ${tabId}:`, error)
    return null
  }
}

/**
 * Build complete TabData by combining tab info with extracted metadata
 * Only extracts metadata from tabs that are fully loaded
 */
async function buildTabData(rawTab: RawTab): Promise<TabData> {
  let metadata: PageMetadata | null = null

  // Only extract metadata from fully loaded tabs
  if (rawTab.status === 'complete') {
    metadata = await extractTabMetadata(rawTab.id)
  }

  return {
    id: rawTab.id,
    url: rawTab.url,
    title: rawTab.title,
    domain: extractDomain(rawTab.url),
    favicon: rawTab.favIconUrl || '',
    description: metadata?.description,
    ogTags: metadata?.ogTags,
    contentSnippet: metadata?.contentSnippet,
    // Use Chrome's timestamp if available, otherwise use current time
    lastAccessed: rawTab.lastAccessed || Date.now(),
  }
}

/**
 * Get all tabs with enriched metadata
 * Uses parallel processing with concurrency limit
 */
export async function getAllTabsWithMetadata(): Promise<TabData[]> {
  const rawTabs = await queryAllTabs()

  // Process tabs in parallel with a higher concurrency limit
  // but still bounded to avoid overwhelming the browser
  const BATCH_SIZE = 10
  const results: TabData[] = []

  for (let i = 0; i < rawTabs.length; i += BATCH_SIZE) {
    const batch = rawTabs.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(buildTabData))
    results.push(...batchResults)
  }

  return results
}
