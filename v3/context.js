{
  const once = chrome.storage.local.get({
    'mode': 'popup',
    'menu:path': true,
    'menu:url': true,
    'menu:date': true
  }, prefs => {
    chrome.contextMenus.create({
      id: 'mode:popup',
      title: 'Open in Popup',
      contexts: ['action'],
      type: 'radio',
      checked: prefs.mode === 'popup'
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'mode:window',
      title: 'Open in Window',
      contexts: ['action'],
      type: 'radio',
      checked: prefs.mode === 'window'
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'reset',
      title: 'Reset Storage',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'menu',
      title: 'Show/Hide Menu Items',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'menu:url',
      title: 'URL',
      contexts: ['action'],
      type: 'checkbox',
      checked: prefs['menu:url'],
      parentId: 'menu'
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'menu:path',
      title: 'Path',
      contexts: ['action'],
      type: 'checkbox',
      checked: prefs['menu:path'],
      parentId: 'menu'
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'menu:date',
      title: 'Date',
      contexts: ['action'],
      type: 'checkbox',
      checked: prefs['menu:date'],
      parentId: 'menu'
    }, () => chrome.runtime.lastError);
  });
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'mode:popup' || info.menuItemId === 'mode:window') {
    chrome.storage.local.set({
      mode: info.menuItemId.slice(5)
    });
  }
  else if (info.menuItemId.startsWith('menu:')) {
    chrome.storage.local.set({
      [info.menuItemId]: info.checked
    });
  }
  else if (info.menuItemId === 'reset') {
    reset();
  }
});
