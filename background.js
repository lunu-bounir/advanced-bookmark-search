/* global xapian */
'use strict';

xapian.config.persistent = true,
xapian.config.object.store = false;

var ports = [];
chrome.runtime.onConnect.addListener(p => {
  p.onDisconnect.addListener(() => {
    const index = ports.indexOf(p);
    if (index !== -1) {
      ports.splice(index, 1);
    }
  });
  ports.push(p);
});

var bookmarks = {
  root: typeof InstallTrigger !== 'undefined' ? 'root________' : '0'
};

bookmarks.date = (timestamp, separator = '') => {
  const d = new Date(timestamp);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();

  return [year, (month.length < 2 ? '0' : '') + month, (day.length < 2 ? '0' : '') + day].join(separator);
};

bookmarks.add = node => {
  const index = Number(localStorage.getItem('counter') || '0');
  localStorage.setItem('counter', index + 1);

  return xapian.add({
    url: node.url,
    title: node.title,
    date: bookmarks.date(node.dateAdded)
  }, {}, node.id);
};

bookmarks.remove = id => {
  const index = Number(localStorage.getItem('counter') || '0');
  localStorage.setItem('counter', Math.max(0, index - 1));

  return xapian.remove(id);
};

bookmarks.children = id => new Promise(resolve => chrome.bookmarks.getChildren(id, resolve));

bookmarks.get = id => new Promise(resolve => chrome.bookmarks.get(id, resolve));

bookmarks.explore = (id = bookmarks.root) => {
  return bookmarks.children(id).then(async nodes => {
    for (const node of nodes) {
      if (node.url) {
        await bookmarks.add(node);
      }
      await bookmarks.explore(node.id);
    }
  });
};

document.addEventListener('xapian-ready', () => {
  chrome.storage.local.get({
    initiated: false
  }, async prefs => {
    if (prefs.initiated === false) {
      await bookmarks.explore();
      chrome.storage.local.set({
        initiated: true
      });
    }
  });
});

chrome.bookmarks.onCreated.addListener((id, node) => bookmarks.add(node));
chrome.bookmarks.onChanged.addListener(async id => {
  const nodes = await bookmarks.get(id);
  for (const node of nodes) {
    await bookmarks.add(node);
  }
});
chrome.bookmarks.onRemoved.addListener(id => bookmarks.remove(id));

// messaging
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'close') {
    if (sender.tab) {
      chrome.windows.remove(sender.tab.windowId);
    }
  }
});

// commands
var onCommand = async command => {
  if (command === 'open') {
    if (ports.length) {
      chrome.windows.update(ports[0].sender.tab.windowId, {
        focused: true
      });
    }
    else {
      chrome.storage.local.get({
        width: 750,
        height: 550,
        left: screen.availLeft + Math.round((screen.availWidth - 700) / 2),
        top: screen.availTop + Math.round((screen.availHeight - 500) / 2)
      }, prefs => {
        chrome.windows.create({
          url: chrome.extension.getURL('data/popup/index.html?mode=window'),
          width: prefs.width,
          height: prefs.height,
          left: prefs.left,
          top: prefs.top,
          type: 'popup'
        }, win => chrome.windows.update(win.id, {
          focused: true
        }));
      });
    }
  }
};
chrome.commands.onCommand.addListener(onCommand);
chrome.browserAction.onClicked.addListener(() => onCommand('open'));

var mode = () => chrome.storage.local.get({
  mode: 'popup'
}, prefs => chrome.browserAction.setPopup({
  popup: prefs.mode === 'window' ? '' : 'data/popup/index.html'
}));

chrome.storage.onChanged.addListener(ps => {
  if (ps.mode) {
    mode();
  }
});
chrome.runtime.onStartup.addListener(mode);
chrome.runtime.onInstalled.addListener(mode);
