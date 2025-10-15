chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  // inject content script into the active tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).catch(err => {
    console.error("ExecuteScript failed:", err);
  });
});
