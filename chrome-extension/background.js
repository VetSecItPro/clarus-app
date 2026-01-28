// Clarus — Service Worker (Background)
// Opens side panel when extension icon is clicked

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error("Failed to set panel behavior:", err));
