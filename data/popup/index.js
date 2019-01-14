/* globals manager */
'use strict';

const BLANK = 'Type a search query to start';
// args
var args = new URLSearchParams(location.search);
document.body.dataset.mode = args.get('mode');

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
      const {size, estimated} = bg.xapian.search({
        query
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
manager.on('copy', async tr => {
  const node = (await bg.bookmarks.get(tr.dataset.id))[0];
  chrome.tabs.create({
    url: node.url
  }, manager.close);
});
