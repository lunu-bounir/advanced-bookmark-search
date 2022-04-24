self.importScripts('context.js');

// observe bookmark changes
{
  const add = id => chrome.storage.local.get({
    'changes': []
  }, prefs => {
    prefs.changes.push(id);

    chrome.storage.local.set({
      changes: prefs.changes.filter((s, i, l) => l.indexOf(s) === i)
    });
  });
  chrome.bookmarks.onCreated.addListener(id => add(id));
  chrome.bookmarks.onChanged.addListener(id => add(id));
  chrome.bookmarks.onRemoved.addListener(id => add(id));
  chrome.bookmarks.onMoved.addListener(id => add(id));
}

// messaging
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'focus') {
    chrome.windows.update(sender.tab.windowId, {
      focused: true
    });
  }
});

// reset
const reset = () => chrome.storage.local.set({
  initiated: false,
  changes: []
}, () => {
  indexedDB.databases().then(r => {
    indexedDB.deleteDatabase(r.name);
  });
});
chrome.bookmarks.onImportEnded.addListener(reset);

// commands
const onCommand = async command => {
  if (command === 'open') {
    chrome.tabs.query({
      currentWindow: true,
      active: true
    }, tabs => {
      chrome.runtime.sendMessage({
        method: 'echo',
        windowId: tabs[0].windowId,
        index: tabs[0].index,
        tabId: tabs[0].id
      }, async r => {
        chrome.runtime.lastError;
        if (r !== true) {
          const win = await chrome.windows.getCurrent();

          chrome.storage.local.get({
            width: 750,
            height: 550,
            left: win.left + Math.round((win.width - 700) / 2),
            top: win.top + Math.round((win.height - 500) / 2)
          }, prefs => {
            let url = 'data/popup/index.html?mode=window';

            if (tabs.length) {
              url += '&windowId=' + tabs[0].windowId;
              url += '&index=' + tabs[0].index;
              url += '&tabId=' + tabs[0].id;
            }
            chrome.windows.create({
              url,
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
      });
    });
  }
};
chrome.commands.onCommand.addListener(onCommand);
chrome.action.onClicked.addListener(() => onCommand('open'));

const mode = () => chrome.storage.local.get({
  mode: 'popup'
}, prefs => chrome.action.setPopup({
  popup: prefs.mode === 'window' ? '' : 'data/popup/index.html'
}));

chrome.storage.onChanged.addListener(ps => {
  if (ps.mode) {
    mode();
  }
});
chrome.runtime.onStartup.addListener(mode);
chrome.runtime.onInstalled.addListener(mode);

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
