let pendingUrls = new Map();
let handledTabs = new Set();
let externalRequests = new Map();

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== "main_frame") return;
    if (details.tabId === -1) return;
    if (details.originUrl || details.documentUrl) return;
    
    externalRequests.set(details.tabId, details.url);
    setTimeout(() => externalRequests.delete(details.tabId), 5000);
  },
  { urls: ["http://*/*", "https://*/*"] }
);

browser.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (handledTabs.has(details.tabId)) return;
  
  const markedUrl = externalRequests.get(details.tabId);
  if (!markedUrl) return;
  
  if (details.transitionType === "typed") {
    externalRequests.delete(details.tabId);
    return;
  }
  
  try {
    const tab = await browser.tabs.get(details.tabId);
    if (tab.openerTabId !== undefined) {
      externalRequests.delete(details.tabId);
      return;
    }
    
    if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
      handledTabs.add(details.tabId);
      externalRequests.delete(details.tabId);
      await handleExternalLink(details.tabId, details.url);
    }
  } catch (e) {
    externalRequests.delete(details.tabId);
  }
}, { url: [{ schemes: ["http", "https"] }] });

browser.tabs.onRemoved.addListener((tabId) => {
  handledTabs.delete(tabId);
  externalRequests.delete(tabId);
});

async function handleExternalLink(tabId, url) {
  const requestId = Date.now().toString();
  pendingUrls.set(requestId, { tabId, url });
  const popupUrl = browser.runtime.getURL(`popup/select.html?requestId=${requestId}&url=${encodeURIComponent(url)}`);
  const popup = await browser.windows.create({
    url: popupUrl,
    type: "popup",
    width: 360,
    height: 400,
    allowScriptsToClose: true
  });
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
