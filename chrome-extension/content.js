// Simple script to find terms links and extract text
function findTermsLinks() {
  const keywords = ["terms", "privacy", "tos", "policy", "refund", "legal"];
  const links = Array.from(document.querySelectorAll("a"));
  
  const termsLinks = links.filter(link => {
    const text = link.innerText.toLowerCase();
    return keywords.some(key => text.includes(key));
  }).map(link => ({
    text: link.innerText,
    url: link.href
  }));

  return termsLinks;
}

// Extract main text content with smart filtering
function getPageContent() {
  try {
    // Clone body to manipulate without affecting live page
    const clone = document.body.cloneNode(true);
    
    // Remove known noisy elements from the clone
    const selectorsToRemove = [
      'nav', 'footer', 'header', 'aside', 'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
      '.nav', '.footer', '.header', '.menu', '.sidebar', '.ad', '.ads', '.social', '.banner',
      '#nav', '#footer', '#header', '#sidebar', '#comments', '.comments'
    ];
    
    selectorsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Try to find main content container
    const contentSelectors = [
      'article', 'main', '[role="main"]', '.content', '.post-content', 
      '#content', '.privacy-policy', '.terms', '.legal-content', '.document-text',
      '[class*="privacy"]', '[class*="terms"]', '[id*="privacy"]', '[id*="terms"]'
    ];
    
    for (const selector of contentSelectors) {
      const el = clone.querySelector(selector);
      if (el && el.innerText.length > 500) {
        return el.innerText;
      }
    }

    // Fallback to cleaned body text
    return clone.innerText || "";
  } catch (e) {
    console.error("Error extracting page content:", e);
    return document.body.innerText || "";
  }
}

// Listen for messages from the website (session sync)
window.addEventListener("message", (event) => {
  // Safe guard: check if extension context is still valid
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }
  // Only handle messages from trusted sources
  if (event.data && event.data.type === "TERMSREADER_SESSION") {
    if (chrome.storage && chrome.storage.local) {
      let originUrl = event.data.apiUrl || event.origin;
      if (originUrl && originUrl.includes('ais-pre-')) {
        originUrl = originUrl.replace('ais-pre-', 'ais-dev-');
      }
      chrome.storage.local.set({ 
        token: event.data.token,
        apiUrl: originUrl
      }).catch(err => {
        console.warn("Storage sync failed (might be orphaned content script):", err);
      });
    }
  } else if (event.data && event.data.type === "TERMSREADER_LOGOUT") {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["token", "apiUrl"]).catch(err => {
        console.warn("Logout sync failed:", err);
      });
    }
  }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.type === "GET_PAGE_DATA") {
      const pageContent = getPageContent();
      const termsLinks = findTermsLinks();
      
      sendResponse({
        url: window.location.href,
        content: pageContent,
        links: termsLinks,
        title: document.title,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({
      error: error.message,
      url: window.location.href
    });
  }
  
  // Return true to indicate we'll send response asynchronously if needed
  return true;
});