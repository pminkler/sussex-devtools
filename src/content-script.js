// Content script that runs in the context of the inspected page
// This script detects Pinia stores and sends them to the DevTools panel

function detectPiniaStores() {
  try {
    // Find an element with a Vue instance
    const element = Array.from(document.querySelectorAll('*')).find((e) => e._vnode);

    if (!element || !element._vnode) {
      return [];
    }

    // Access the Pinia instance
    const pinia = element._vnode.appContext.app.config.globalProperties.$pinia;

    if (!pinia || !pinia._s) {
      return [];
    }

    // Extract all store IDs from the Map
    const storeIds = Array.from(pinia._s.keys());

    return storeIds;
  } catch (error) {
    console.error('Error detecting Pinia stores:', error);
    return [];
  }
}

// Listen for messages from the DevTools panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStores') {
    const stores = detectPiniaStores();
    sendResponse({ stores });
  }
  return true; // Keep the message channel open for async response
});

// Notify DevTools panel that content script is ready
chrome.runtime.sendMessage({
  action: 'contentScriptReady',
  tabId: chrome.devtools?.inspectedWindow?.tabId
});
