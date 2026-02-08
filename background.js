let pendingUrls = new Map();
let handledTabs = new Set();
let externalCandidates = new Map();

browser.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId === undefined) {
    const initialUrl = tab.url || tab.pendingUrl || '';
    externalCandidates.set(tab.id, { created: Date.now(), initialUrl });
    setTimeout(() => externalCandidates.delete(tab.id), 5000);
  }
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== "main_frame") return;
    if (details.tabId === -1) return;
    if (handledTabs.has(details.tabId)) return;
    
    const candidate = externalCandidates.get(details.tabId);
    if (candidate && !details.originUrl && !details.documentUrl) {
      candidate.url = details.url;
    }
  },
  { urls: ["http://*/*", "https://*/*"] }
);

browser.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (handledTabs.has(details.tabId)) return;
  
  const candidate = externalCandidates.get(details.tabId);
  if (!candidate || !candidate.url) return;
  
  const age = Date.now() - candidate.created;
  if (age > 3000) {
    externalCandidates.delete(details.tabId);
    return;
  }
  
  // Only allow 'link' transition type (external links from OS).
  // All other types are browser-internal: typed, auto_bookmark, generated,
  // keyword, keyword_generated, reload, form_submit, start_page, etc.
  if (details.transitionType !== "link") {
    externalCandidates.delete(details.tabId);
    return;
  }
  
  // Filter navigations initiated from the address bar (e.g. URL suggestions)
  if (details.transitionQualifiers &&
      details.transitionQualifiers.includes('from_address_bar')) {
    externalCandidates.delete(details.tabId);
    return;
  }
  
  // Filter navigations from internal pages (new tab, home page, pinned sites)
  if (candidate.initialUrl &&
      (candidate.initialUrl === 'about:newtab' ||
       candidate.initialUrl === 'about:home' ||
       candidate.initialUrl === 'about:privatebrowsing')) {
    externalCandidates.delete(details.tabId);
    return;
  }
  
  try {
    const tab = await browser.tabs.get(details.tabId);
    
    if (tab.openerTabId !== undefined) {
      externalCandidates.delete(details.tabId);
      return;
    }
    
    if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
      handledTabs.add(details.tabId);
      const urlToOpen = candidate.url;
      externalCandidates.delete(details.tabId);
      
      try {
        await browser.tabs.update(details.tabId, { url: "about:blank" });
      } catch (e) {}
      
      await handleExternalLink(details.tabId, urlToOpen);
    }
  } catch (e) {
    externalCandidates.delete(details.tabId);
  }
}, { url: [{ schemes: ["http", "https"] }] });

browser.tabs.onRemoved.addListener((tabId) => {
  handledTabs.delete(tabId);
  externalCandidates.delete(tabId);
});

async function handleExternalLink(tabId, url) {
  const requestId = Date.now().toString();
  pendingUrls.set(requestId, { tabId, url });
  const popupUrl = browser.runtime.getURL(`popup/select.html?requestId=${requestId}&url=${encodeURIComponent(url)}`);
  
  const width = 400;
  const height = 600;
  
  // Center the popup on the current browser window
  const createOptions = {
    url: popupUrl,
    type: "popup",
    width: width,
    height: height,
    allowScriptsToClose: true
  };
  try {
    const currentWindow = await browser.windows.getCurrent();
    createOptions.left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
    createOptions.top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);
  } catch (e) {}
  
  const popup = await browser.windows.create(createOptions);
  
  // Force resize — Firefox sometimes ignores initial dimensions
  try {
    await browser.windows.update(popup.id, { width, height });
  } catch (e) {}
  
  pendingUrls.get(requestId).popupId = popup.id;
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "openInContainer") {
    const { requestId, containerId, url } = message;
    const pending = pendingUrls.get(requestId);
    if (pending) {
      try {
        await browser.tabs.remove(pending.tabId);
      } catch (e) {}
      await browser.tabs.create({
        url: url,
        cookieStoreId: containerId
      });
      pendingUrls.delete(requestId);
    }
    if (sender.tab && sender.tab.windowId) {
      try {
        await browser.windows.remove(sender.tab.windowId);
      } catch (e) {}
    }
    return { success: true };
  }
  
  if (message.action === "openWithoutContainer") {
    const { requestId, url } = message;
    const pending = pendingUrls.get(requestId);
    if (pending) {
      try {
        await browser.tabs.update(pending.tabId, { url: url });
      } catch (e) {
        await browser.tabs.create({ url: url });
      }
      pendingUrls.delete(requestId);
    }
    if (sender.tab && sender.tab.windowId) {
      try {
        await browser.windows.remove(sender.tab.windowId);
      } catch (e) {}
    }
    return { success: true };
  }
  
  if (message.action === "cancel") {
    const { requestId } = message;
    const pending = pendingUrls.get(requestId);
    if (pending) {
      try {
        await browser.tabs.remove(pending.tabId);
      } catch (e) {}
      pendingUrls.delete(requestId);
    }
    if (sender.tab && sender.tab.windowId) {
      try {
        await browser.windows.remove(sender.tab.windowId);
      } catch (e) {}
    }
    return { success: true };
  }
  
  if (message.action === "getContainers") {
    const containers = await browser.contextualIdentities.query({});
    return containers;
  }
  
  if (message.action === "createContainer") {
    const { name, color, icon } = message;
    const container = await browser.contextualIdentities.create({
      name: name,
      color: color,
      icon: icon
    });
    return container;
  }
});

browser.windows.onRemoved.addListener((windowId) => {
  for (const [requestId, pending] of pendingUrls.entries()) {
    if (pending.popupId === windowId) {
      pendingUrls.delete(requestId);
    }
  }
});
