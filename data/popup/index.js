/* globals manager */
'use strict';

const BLANK = 'Type a search query to start';
// args
var args = new URLSearchParams(location.search);
document.body.dataset.mode = args.get('mode');

var port = chrome.runtime.connect();
port.onMessage.addListener(request => {
  console.log(request);
  if (request.method === 'update') {
    args.set('windowId', request.windowId);
    args.set('index', request.index);
  }
});

var search = document.getElementById('search');
var bg;

search.addEventListener('submit', e => e.preventDefault());
search.querySelector('input').addEventListener('blur', e => e.target.focus());

chrome.runtime.getBackgroundPage(_bg => {
  bg = _bg;
  search.addEventListener('input', async e => {
    const query = e.target.value;
    manager.clear(query ? '' : BLANK);
    if (query) {
      const now = Date.now();
      const lang = await bg.bookmarks.language(query);
      const {size, estimated} = bg.xapian.search({
        query,
        lang
      });
      manager.log(`About ${estimated} results (${((Date.now() - now) / 1000).toFixed(2)} seconds in ${localStorage.getItem('counter') || '0'} bookmarks)`);
      for (let i = 0; i < size; i += 1) {
        const id = bg.xapian.search.guid(i);
        const node = (await bg.bookmarks.get(id))[0];
        if (node) {
          node.id = id;
          node.date = bg.bookmarks.date(node.dateAdded, '.');
          node.percent = bg.xapian.search.percent(i);
          manager.add(node, 'advance-bookmark-search');
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
manager.on('copy', async (tr, e) => {
  const node = (await bg.bookmarks.get(tr.dataset.id))[0];
  if (e.shiftKey) {
    chrome.tabs.update(args.has('tabId') ? Number(args.get('tabId')) : null, {
      url: node.url
    }, manager.close);
  }
  else {
    const opts = {
      url: node.url,
      active: e.metaKey ? false : true
    };
    if (args.has('windowId')) {
      opts.windowId = Number(args.get('windowId'));
      opts.index = Number(args.get('index')) + 1;
    }
    chrome.tabs.create(opts, manager.close);
  }
});
