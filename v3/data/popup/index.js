/* global manager, xapian, bookmarks */
'use strict';

const BLANK = 'Type a search query to start';

const storage = new Set();

// args
const args = new URLSearchParams(location.search);
document.body.dataset.mode = args.get('mode');

const search = document.getElementById('search');

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'echo') {
    args.set('windowId', request.windowId);
    args.set('index', request.index);

    response(true);

    chrome.runtime.sendMessage({
      method: 'focus'
    });
  }
});

search.addEventListener('submit', e => e.preventDefault());
search.querySelector('input').addEventListener('blur', e => e.target.focus());
{
  let active = 0;
  search.addEventListener('input', async e => {
    const query = e.target.value;
    manager.clear(query ? '' : BLANK);
    if (query) {
      const now = Date.now();
      active = now;
      const lang = await bookmarks.language(query);
      const {size, estimated} = xapian.search({
        query,
        lang
      });
      manager.log(`About ${estimated} results (${((Date.now() - now) / 1000).toFixed(2)} seconds in ${localStorage.getItem('counter') || '0'} bookmarks)`);
      for (let i = 0; i < size; i += 1) {
        const id = xapian.search.guid(i);
        const node = (await bookmarks.get(id))[0];
        await bookmarks.path(node);

        if (active !== now) { // in case a new search is performed
          break;
        }
        if (node) {
          node.id = id;
          node.date = bookmarks.date(node.dateAdded, '.');
          node.percent = xapian.search.percent(i);
          const tr = manager.add(node);
          tr.dataset.url = node.url;
          if (storage.has(node.url)) {
            tr.classList.add('storage');
          }
        }
      }
      manager.select();
      if (size === 0) {
        manager.clear('No result for this query');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => manager.clear(BLANK));

// events
manager.on('storage', () => {
  manager.list().forEach(tr => {
    const url = tr.dataset.url;
    tr.classList[storage.has(url) ? 'add' : 'remove']('storage');
  });
  document.getElementById('storage').textContent = `${storage.size} item(s) selected`;
});
manager.on('copy', async (tr, e) => {
  const url = tr.dataset.url;
  const create = opts => new Promise(resolve => chrome.tabs.create(opts, resolve));
  // store in a temp storage
  if (e.altKey) {
    storage[storage.has(url) ? 'delete' : 'add'](url);
    manager.emit('storage');
  }
  else if (e.shiftKey) {
    chrome.tabs.update(args.has('tabId') ? Number(args.get('tabId')) : null, {
      url
    }, manager.close);
  }
  else {
    storage.add(url);
    const tabs = [...storage].map(url => ({
      url
    }));
    if (e.metaKey) {
      tabs.forEach(tab => tab.active = false);
    }
    if (args.has('windowId')) {
      tabs.forEach((tab, i) => {
        tab.windowId = Number(args.get('windowId'));
        tab.index = Number(args.get('index')) + 1 + i;
      });
    }
    Promise.all(tabs.map(tab => create(tab))).then(manager.close);
  }
});

// visual
chrome.storage.local.get({
  'menu:date': true,
  'menu:path': true,
  'menu:url': true
}, prefs => {
  document.body.dataset.date = prefs['menu:date'];
  document.body.dataset.path = prefs['menu:path'];
  document.body.dataset.url = prefs['menu:url'];
});