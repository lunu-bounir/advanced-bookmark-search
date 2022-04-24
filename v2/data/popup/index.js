/* globals manager */
'use strict';

const BLANK = 'Type a search query to start';

const storage = new Set();

// args
const args = new URLSearchParams(location.search);
document.body.dataset.mode = args.get('mode');

const port = chrome.runtime.connect();
port.onMessage.addListener(request => {
  if (request.method === 'update') {
    args.set('windowId', request.windowId);
    args.set('index', request.index);
  }
});

const search = document.getElementById('search');
let bg;

search.addEventListener('submit', e => e.preventDefault());
search.querySelector('input').addEventListener('blur', e => e.target.focus());

chrome.runtime.getBackgroundPage(_bg => {
  bg = _bg;
  let active = 0;
  search.addEventListener('input', async e => {
    const query = e.target.value;
    manager.clear(query ? '' : BLANK);
    if (query) {
      const now = Date.now();
      active = now;
      const lang = await bg.bookmarks.language(query);
      const {size, estimated} = bg.xapian.search({
        query,
        lang
      });
      manager.log(`About ${estimated} results (${((Date.now() - now) / 1000).toFixed(2)} seconds in ${localStorage.getItem('counter') || '0'} bookmarks)`);
      for (let i = 0; i < size; i += 1) {
        const id = bg.xapian.search.guid(i);
        const node = (await bg.bookmarks.get(id))[0];
        if (active !== now) { // in case a new search is performed
          break;
        }
        if (node) {
          node.id = id;
          node.date = bg.bookmarks.date(node.dateAdded, '.');
          node.percent = bg.xapian.search.percent(i);
          const tr = manager.add(node, 'advance-bookmark-search');
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
});

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
