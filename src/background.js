// Background service worker for Chrome extension
// Handles communication between content script and DevTools panel

// Store connections to DevTools panels
const connections = {};

// Listen for connections from DevTools panels
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    const extensionListener = (message, sender, sendResponse) => {
      if (message.action === 'init') {
        connections[message.tabId] = port;
      }

      // Forward messages to content script
      if (message.action === 'getStores') {
        chrome.tabs.sendMessage(message.tabId, { action: 'getStores' }, (response) => {
          port.postMessage({
            action: 'storesData',
            stores: response?.stores || []
          });
        });
      }
    };

    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener((port) => {
      port.onMessage.removeListener(extensionListener);

      // Clean up
      const tabs = Object.keys(connections);
      for (let i = 0; i < tabs.length; i++) {
        if (connections[tabs[i]] === port) {
          delete connections[tabs[i]];
          break;
        }
      }
    });
  }
});
