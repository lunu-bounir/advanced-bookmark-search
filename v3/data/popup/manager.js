'use strict';

const manager = {
  index: 1,
  callbacks: {}
};

manager.on = (name, callback) => {
  manager.callbacks[name] = manager.callbacks[name] || [];
  manager.callbacks[name].push(callback);
};
manager.emit = (name, ...values) => {
  (manager.callbacks[name] || []).forEach(c => c(...values));
};

manager.observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    e.target.dataset.intersecting = e.isIntersecting;
    if (!e.target.nextElementSibling && e.isIntersecting) {
      manager.emit('last-child', e.target);
    }
    if (!e.target.previousElementSibling && e.isIntersecting) {
      manager.emit('first-child', e.target);
    }
  });
  clearTimeout(manager.observer.id);
  manager.observer.id = setTimeout(() => {
    [...document.querySelectorAll('#results [data-intersecting=true]')].forEach((span, i) => {
      span.textContent = i + 1;
      span.parentElement.dataset.index = i + 1;
    });
  }, 100);
}, {});

manager.clear = (msg = '') => {
  const div = document.querySelector('#results');
  div.textContent = '';
  div.dataset.msg = msg;
  manager.index = 1;
};

manager.add = object => {
  const t = document.getElementById('entry');
  const clone = document.importNode(t.content, true);

  clone.querySelector('[data-id=title]').textContent = object.title;
  clone.querySelector('[data-id=title]').title = object.title;
  clone.querySelector('[data-id=url]').textContent = object.url;
  clone.querySelector('[data-id=url]').title = object.url;
  clone.querySelector('[data-id=path]').textContent = object.path;
  clone.querySelector('[data-id=path]').title = object.path;
  clone.querySelector('[data-id=date]').textContent = object.date;
  clone.querySelector('[data-id=percent]').textContent = object.percent;

  const div = clone.querySelector('.entry');
  div.dataset.id = object.id;
  clone.querySelector('span').textContent = manager.index++;
  document.querySelector('#results').appendChild(clone);

  manager.observer.observe(div.children[0], {
    threshold: 0.5
  });

  return div;
};
manager.update = ({title = '', body = '', url = '', pinned = false}, index) => {
  const div = document.querySelector(`#results .entry:nth-child(${index})`);
  if (div) {
    div.querySelector('[data-id=title]').textContent = title;
    div.querySelector('[data-id=body]').textContent = body;
    div.querySelector('[data-id=url]').textContent = url;
    Object.assign(div.dataset, {
      pinned
    });
  }
};
manager.list = () => {
  return [...document.querySelectorAll('.entry')];
};

manager._select = div => {
  if (div) {
    div.children[0].scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
    div.classList.add('selected');
    manager.emit('select', div);
  }
};

manager.select = (div = document.querySelector('#results .entry')) => {
  [...document.querySelectorAll('.entry.selected')].forEach(div => div.classList.remove('selected'));
  manager._select(div);
};
manager.select.next = () => {
  const div = document.querySelector('#results .entry.selected + .entry');
  if (div) {
    div.previousElementSibling.classList.remove('selected');
    manager._select(div);
  }
};
manager.select.previous = () => {
  const div = document.querySelector('#results .entry + .entry.selected');
  if (div) {
    div.classList.remove('selected');
    manager._select(div.previousElementSibling);
  }
};

manager.close = () => window.close();

manager.log = msg => {
  const footer = document.getElementById('footer');
  if (footer) {
    footer.textContent = msg;
  }
};

document.addEventListener('keydown', e => {
  if (e.code.startsWith('Digit') && e.metaKey) {
    const div = [...document.querySelectorAll(`.entry[data-index="${e.key}"]`)]
      .filter(e => e.querySelector('[data-intersecting=true]')).shift();
    if (div) {
      manager.select(div);
    }
    e.preventDefault();
  }
  else if (e.code === 'ArrowUp') {
    manager.select.previous();
    e.preventDefault();
  }
  else if (e.code === 'ArrowDown') {
    manager.select.next();
    e.preventDefault();
  }
  else if (e.code === 'Enter') {
    const div = document.querySelector('#results .entry.selected');
    if (div) {
      manager.emit('copy', div, e);
    }
  }
});
document.addEventListener('dblclick', e => {
  const div = e.target.closest('#results .entry');
  if (div) {
    manager.emit('copy', div, e);
  }
});
document.addEventListener('click', e => {
  const entry = e.target.closest('.entry');
  const cmd = e.target.dataset.cmd;
  if (entry && !cmd) {
    manager.select(entry);
  }
  if (cmd) {
    manager.emit(cmd, entry);
  }
});

