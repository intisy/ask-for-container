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
    if (!candidate) return;
    if (details.originUrl || details.documentUrl) return;

    const age = Date.now() - candidate.created;
    if (age > 3000) {
      externalCandidates.delete(details.tabId);
      return;
    }

    if (candidate.initialUrl &&
        (candidate.initialUrl === 'about:newtab' ||
         candidate.initialUrl === 'about:home' ||
         candidate.initialUrl === 'about:privatebrowsing')) {
      externalCandidates.delete(details.tabId);
      return;
    }

    candidate.url = details.url;
    handledTabs.add(details.tabId);
    externalCandidates.delete(details.tabId);

    handleCandidate(details.tabId, candidate);

    return { cancel: true };
  },
  { urls: ["http://*/*", "https://*/*"] },
  ["blocking"]
);

async function handleCandidate(tabId, candidate) {
  try {
    const tab = await browser.tabs.get(tabId);

    if (tab.openerTabId !== undefined) {
      handledTabs.delete(tabId);
      try { await browser.tabs.update(tabId, { url: candidate.url }); } catch (e) {}
      return;
    }

    if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
      handledTabs.delete(tabId);
      try { await browser.tabs.update(tabId, { url: candidate.url }); } catch (e) {}
      return;
    }

    await handleExternalLink(tabId, candidate.url);
  } catch (e) {
    handledTabs.delete(tabId);
  }
}

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

  try {
    await browser.windows.update(popup.id, { width, height });
  } catch (e) {}

  pendingUrls.get(requestId).popupId = popup.id;
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "openInContainer") {
    const { requestId, containerId } = message;
    const pending = pendingUrls.get(requestId);
    if (pending) {
      try {
        await browser.tabs.remove(pending.tabId);
      } catch (e) {}
      await browser.tabs.create({
        url: pending.url,
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
    const { requestId } = message;
    const pending = pendingUrls.get(requestId);
    if (pending) {
      try {
        await browser.tabs.update(pending.tabId, { url: pending.url });
      } catch (e) {
        await browser.tabs.create({ url: pending.url });
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
