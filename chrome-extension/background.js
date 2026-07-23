chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel error:", error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_PAGE") {
    console.log("Analyzing page:", request.url);
    // You can add additional processing here if needed
    // For now, this is primarily handled by sidebar.js
  }
  
  // Always return true to keep the message channel open for async responses
  return true;
});

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Termsreader extension installed');
  } else if (details.reason === 'update') {
    console.log('Termsreader extension updated');
  }
});