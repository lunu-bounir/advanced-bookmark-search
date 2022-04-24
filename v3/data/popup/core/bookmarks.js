/* global xapian, manager */

const bookmarks = {
  root: typeof InstallTrigger !== 'undefined' ? 'root________' : '0'
};

bookmarks.date = (timestamp, separator = '') => {
  const d = new Date(timestamp);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();

  return [year, (month.length < 2 ? '0' : '') + month, (day.length < 2 ? '0' : '') + day].join(separator);
};

bookmarks.language = query => new Promise(resolve => chrome.i18n.detectLanguage(query, obj => {
  const convert = code => {
    code = code.split('-')[0];
    return ({
      'ar': 'arabic',
      'fa': 'arabic',
      'hy': 'armenian',
      'eu': 'basque',
      'ca': 'catalan',
      'da': 'danish',
      'nl': 'dutch',
      'en': 'english',
      'fi': 'finnish',
      'fr': 'french',
      'de': 'german',
      'hu': 'hungarian',
      'id': 'indonesian',
      'ga': 'irish',
      'it': 'italian',
      'lt': 'lithuanian',
      'ne': 'nepali',
      'no': 'norwegian',
      'nn': 'norwegian',
      'nb': 'norwegian',
      'pt': 'portuguese',
      'ro': 'romanian',
      'ru': 'russian',
      'es': 'spanish',
      'sv': 'swedish',
      'ta': 'tamil',
      'tr': 'turkish'
    })[code] || 'english';
  };
  const code = obj && obj.languages.length ? obj.languages[0].language : 'en';
  resolve(convert(code));
}));

{
  const cache = {};
  bookmarks.path = node => {
    const once = (node, paths) => {
      if (node.parentId === bookmarks.root) {
        return paths;
      }
      return bookmarks.get(node.parentId).then(([parent]) => {
        paths.push(parent.title);
        return once(parent, paths);
      });
    };

    if (node.path) {
      return;
    }

    if (cache[node.parentId]) {
      node.path = cache[node.parentId];
      return;
    }

    const paths = [];
    return once(node, paths).then(() => {
      paths.reverse();
      node.path = cache[node.parentId] = paths.join('/');
      return;
    });
  };
}

bookmarks.add = async (node, msg = '') => {
  if (node.url) {
    manager.log(node.title.slice(-100) + msg);

    await bookmarks.path(node);

    return xapian.add({
      url: node.url,
      title: node.title,
      date: bookmarks.date(node.dateAdded),
      body: node.path
    }, {}, node.id);
  }
};

bookmarks.remove = id => {
  manager.log('Removing bookmark id ' + id);

  return xapian.remove(id);
};

bookmarks.children = id => new Promise(resolve => chrome.bookmarks.getChildren(id, resolve));

bookmarks.get = id => new Promise(resolve => chrome.bookmarks.get(id, nodes => {
  chrome.runtime.lastError;
  resolve(nodes);
}));

bookmarks.explore = (id = bookmarks.root, nodes = []) => {
  manager.log('Collecting bookmarks (' + nodes.length + ')...');

  return bookmarks.children(id).then(async nds => {
    for (const node of nds) {
      nodes.push(node);
      await bookmarks.explore(node.id, nodes);
    }
  });
};

xapian.config.persistent = true,
xapian.config.object.store = false;

document.addEventListener('xapian-ready', () => {
  chrome.storage.local.get({
    initiated: false,
    changes: []
  }, async prefs => {
    if (prefs.initiated === false) {
      const nodes = [];
      await bookmarks.explore(undefined, nodes);

      for (let i = 0; i < nodes.length; i += 1) {
        await bookmarks.add(nodes[i], ' - ' + (i / nodes.length * 100).toFixed(0) + '%');
      }

      chrome.storage.local.set({
        initiated: true
      }, () => {
        manager.log('Initial Indexing Finished');
      });
    }
    else if (prefs.changes.length) {
      manager.log('Reindexing changes...');
      for (const id of prefs.changes) {
        const nodes = await bookmarks.get(id);
        if (nodes) {
          for (const node of nodes) {
            await bookmarks.add(node);
          }
        }
        else {
          await bookmarks.remove(id);
        }
      }
      chrome.storage.local.set({
        changes: []
      }, () => {
        manager.log('Reindexing Finished');
      });
    }
    else {
      manager.log('Ready');
    }
  });
});

