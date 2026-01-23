let pendingUrls = new Map();

browser.tabs.onCreated.addListener(async (tab) => {
  if (tab.url && tab.url !== "about:blank" && tab.url !== "about:newtab") {
    if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) {
      return;
    }
    if (!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
      await handleExternalLink(tab.id, tab.url);
    }
  }
});

browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (details.url.startsWith("about:") || 
      details.url.startsWith("moz-extension:") ||
      details.url.startsWith("data:")) {
    return;
  }
  try {
    const tab = await browser.tabs.get(details.tabId);
    if ((!tab.cookieStoreId || tab.cookieStoreId === "firefox-default") && 
        tab.url === "about:blank") {
      await handleExternalLink(details.tabId, details.url);
    }
  } catch (e) {
    console.log("Tab not found:", e);
  }
}, { url: [{ schemes: ["http", "https", "ftp"] }] });

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
