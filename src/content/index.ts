// Content script for extracting page metadata

interface PageMetadata {
  title: string
  description?: string
  ogTags?: {
    title?: string
    description?: string
    type?: string
    image?: string
  }
  contentSnippet?: string
}

function extractMetadata(): PageMetadata {
  // Get meta description
  const metaDescription = document.querySelector('meta[name="description"]')
  const description = metaDescription?.getAttribute('content') || undefined

  // Get Open Graph tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
  const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content')
  const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content')
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')

  const ogTags =
    ogTitle || ogDescription || ogType || ogImage
      ? {
          title: ogTitle || undefined,
          description: ogDescription || undefined,
          type: ogType || undefined,
          image: ogImage || undefined,
        }
      : undefined

  // Get content snippet from body (first 500 chars of visible text)
  let contentSnippet: string | undefined
  try {
    const body = document.body
    if (body) {
      const text = body.innerText.replace(/\s+/g, ' ').trim()
      contentSnippet = text.slice(0, 500)
    }
  } catch {
    // Ignore content extraction errors
  }

  return {
    title: document.title,
    description,
    ogTags,
    contentSnippet,
  }
}

// Listen for metadata requests from service worker
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_PAGE_METADATA') {
    const metadata = extractMetadata()
    sendResponse({ success: true, data: metadata })
  }
  return true
})

// Log that content script is loaded (for debugging)
console.log('Intent Tab Organizer: Content script loaded on', window.location.hostname)

export {}
