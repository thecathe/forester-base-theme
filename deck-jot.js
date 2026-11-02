// SPDX-License-Identifier: CC0-1.0
//
// Jotted notes: a pane over the stage for what is raised during the talk (a question, a comment, a suggestion). It is
// opened and closed with the key m or the pen in the toolbar, and only while presenting. It is a chat with the field at
// the bottom: a note is dispatched with Enter (Shift+Enter is a new line) and sits above the field, the older ones above it,
// the oldest at the top, so a long list runs off the top and the pane keeps the newest in view.
//
// A note has a number (kept for good: a note that is deleted keeps its number), the time, and the slide it was written on
// (its number and title). It can be edited (it then says when) and deleted, which crosses it out and shrinks it to a line,
// with a way back. The pane is global: every note is shown on every slide.
//
// The notes stay on the device: they are kept in the browser's localStorage, under the page's address, so a reload does not
// lose them, and nothing is sent anywhere. The pane is built here and not in the page, so the published page holds none of it.
// A text file of them (deleted ones marked) is made in the browser and offered to be saved. If the browser refuses to keep
// them (a private window), the pane says so and goes on working until the page is closed.
//
// deck.js installs it with the deck. It is told which slide is on show ('deck:show') and when presenting stops
// ('deck:present'), and hands back the toolbar's button, key(e) for deck-keys.js, and report() for the text file.

const FORMAT = 1;

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${clock(ms)}`;
};

// The words that mark an edited and a deleted note in the text file.
const MARKS = { edited: 'edited', deleted: 'DELETED' };

export function installJot(deck) {
  const { root, slides, state } = deck;
  const { el, button, icon } = deck.ui;
  const { titleOf } = deck.shape;

  // ---- the notes, and where they are kept ----

  const key = `deck-jot:${location.pathname.replace(/index\.html$/, '')}`;
  let kept = true; // false once the browser has refused to keep them
  const fresh = () => ({ v: FORMAT, next: 1, notes: [] });

  function load() {
    try {
      const raw = localStorage.getItem(key);
      const data = raw && JSON.parse(raw);
      if (data && data.v === FORMAT && Array.isArray(data.notes) && Number.isInteger(data.next)) return data;
    } catch {
      kept = false;
    }
    return fresh();
  }

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      kept = false;
    }
    renderHead();
  }

  let data = load();
  const find = (n) => data.notes.find((note) => note.n === n);

  function add(text) {
    const i = Math.max(0, state.current);
    data.notes.push({
      n: data.next++, at: Date.now(), text, slide: i + 1, title: titleOf(slides[i]), edited: null, deleted: null,
    });
    save();
  }

  // ---- the text file ----

  // The notes as a text file: oldest first, each with its number, when and where, and a mark when it was edited or deleted.
  function report() {
    const out = [`Jotted notes: ${titleOf(root)}`, `Page: ${location.pathname}`, `Saved: ${stamp(Date.now())}`];
    const gone = data.notes.filter((note) => note.deleted).length;
    out.push(`Notes: ${data.notes.length}${gone > 0 ? ` (${gone} deleted, marked below)` : ''}`, '');
    for (const note of data.notes) {
      const marks = [];
      if (note.edited) marks.push(`${MARKS.edited} ${stamp(note.edited)}`);
      if (note.deleted) marks.push(`${MARKS.deleted} ${stamp(note.deleted)}`);
      out.push(`#${note.n}  ${stamp(note.at)}  slide ${note.slide}: ${note.title}${marks.length > 0 ? `  [${marks.join('; ')}]` : ''}`);
      for (const line of note.text.split('\n')) out.push(`    ${line}`);
      out.push('');
    }
    if (data.notes.length === 0) out.push('(no notes)', '');
    return out.join('\n');
  }

  function download() {
    const slug = location.pathname.split('/').filter((p) => p && p !== 'index.html').pop() || 'deck';
    const day = stamp(Date.now()).slice(0, 10);
    const link = el('a');
    link.href = URL.createObjectURL(new Blob([report()], { type: 'text/plain;charset=utf-8' }));
    link.download = `${slug}-jotted-notes-${day}.txt`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }

  // ---- the pane ----

  const pane = el('aside', 'deck-jot');
  pane.setAttribute('aria-label', 'Jotted notes');
  pane.hidden = true;

  const heading = el('span', 'deck-jot-title', 'Jotted notes');
  const counter = el('span', 'deck-jot-count');
  const unkept = el('span', 'deck-jot-unkept', '⚠ not kept: this browser will not store them');
  const saveAs = () => { download(); refocus(); };
  const downloadButton = button('deck-jot-text-button', 'Download', 'Save the notes as a text file', saveAs);
  const clearButton = button('deck-jot-text-button', 'Clear…', 'Remove every note from this browser', () => askToClear(true));
  const closeButton = button('deck-jot-close', '×', 'Close (m or Esc)', () => close());
  closeButton.setAttribute('aria-label', 'Close the jotted notes');
  const head = el('div', 'deck-jot-head');
  const actions = el('span', 'deck-jot-actions');
  actions.append(downloadButton, clearButton, closeButton);
  head.append(heading, counter, actions);

  const confirmBar = el('div', 'deck-jot-confirm');
  confirmBar.hidden = true;
  const confirmText = el('span');
  const confirmRow = el('span', 'deck-jot-actions');
  confirmRow.append(
    button('deck-jot-text-button', 'Download first', 'Save the notes as a text file', saveAs),
    button('deck-jot-text-button deck-jot-danger', 'Clear all', 'Remove every note', () => { data = fresh(); save(); askToClear(false); render(); }),
    button('deck-jot-text-button', 'Cancel', 'Keep them', () => { askToClear(false); refocus(); }),
  );
  confirmBar.append(confirmText, confirmRow);

  const list = el('div', 'deck-jot-list');

  const compose = el('div', 'deck-jot-compose');
  const where = el('div', 'deck-jot-where');
  const field = el('textarea', 'deck-jot-field');
  field.rows = 2;
  field.placeholder = 'Write a note. Enter sends it, Shift+Enter starts a new line.';
  field.setAttribute('aria-label', 'A note to jot down');
  const send = button('deck-jot-send', 'Add', 'Add the note (Enter)', () => dispatch());
  const row = el('div', 'deck-jot-send-row');
  row.append(where, send);
  compose.append(field, row);

  pane.append(head, confirmBar, list, compose);
  document.body.append(pane);

  function askToClear(on) {
    confirmBar.hidden = !on;
    confirmText.textContent = `Remove all ${data.notes.length} note${data.notes.length === 1 ? '' : 's'} from this browser? Download them first if you want them.`;
  }

  function renderHead() {
    const live = data.notes.filter((note) => !note.deleted).length;
    counter.textContent = data.notes.length === 0 ? '' : `${live} note${live === 1 ? '' : 's'}${live < data.notes.length ? `, ${data.notes.length - live} deleted` : ''}`;
    unkept.hidden = kept;
    downloadButton.disabled = data.notes.length === 0;
    clearButton.disabled = data.notes.length === 0;
    if (head.contains(unkept) === false && !kept) heading.after(unkept);
  }

  // A note, in its three states: as written, being edited, or deleted (a line, crossed out, with a way back).
  let editing = null;

  function noteElement(note) {
    const item = el('div', `deck-jot-note${note.deleted ? ' deck-jot-gone' : ''}`);
    item.dataset.n = String(note.n);
    const meta = el('div', 'deck-jot-meta');
    const time = el('span', 'deck-jot-time', clock(note.at));
    time.title = stamp(note.at);
    const slide = el('span', 'deck-jot-slide', `slide ${note.slide}: ${note.title}`);
    slide.title = `Written on slide ${note.slide}: ${note.title}`;
    meta.append(el('span', 'deck-jot-num', `#${note.n}`), time, slide);
    if (note.edited) {
      const edited = el('span', 'deck-jot-mark', `edited ${clock(note.edited)}`);
      edited.title = stamp(note.edited);
      meta.append(edited);
    }
    if (note.deleted) {
      const gone = el('span', 'deck-jot-mark', `deleted ${clock(note.deleted)}`);
      gone.title = stamp(note.deleted);
      meta.append(gone);
    }
    const tools = el('span', 'deck-jot-tools');
    if (note.deleted) {
      tools.append(button('deck-jot-tool', '↩', 'Bring this note back', () => { note.deleted = null; save(); render(); }));
    } else {
      tools.append(
        button('deck-jot-tool', '✎', 'Edit this note', () => { editing = note.n; render(); }),
        button('deck-jot-tool', '✕', 'Delete this note (it is crossed out and kept)', () => { note.deleted = Date.now(); if (editing === note.n) editing = null; save(); render(); }),
      );
    }
    meta.append(tools);
    item.append(meta);

    if (editing === note.n && !note.deleted) {
      const box = el('textarea', 'deck-jot-field deck-jot-edit');
      box.value = note.text;
      box.rows = Math.min(8, Math.max(2, note.text.split('\n').length));
      box.setAttribute('aria-label', `Edit note ${note.n}`);
      const finish = (keep) => {
        const text = box.value.trim();
        if (keep) {
          if (text === '') return; // an empty note is a delete, which is its own button
          if (text !== note.text) { note.text = text; note.edited = Date.now(); save(); }
        }
        editing = null;
        render();
      };
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      });
      const done = el('div', 'deck-jot-edit-row');
      done.append(button('deck-jot-text-button', 'Save', 'Keep the change (Enter)', () => finish(true)), button('deck-jot-text-button', 'Cancel', 'Leave the note as it was (Esc)', () => finish(false)));
      item.append(box, done);
      queueMicrotask(() => { box.focus(); box.setSelectionRange(box.value.length, box.value.length); });
    } else {
      item.append(el('div', 'deck-jot-text', note.text));
    }
    return item;
  }

  function render() {
    list.replaceChildren(...data.notes.map(noteElement));
    renderHead();
    refocus();
  }

  // After an action in the pane (a button lets go of the focus when clicked) the cursor goes back to the field, so the next
  // key is a letter of a note and not a move of the deck. Not while a note is being edited: that field takes it.
  function refocus() {
    if (isOpen() && editing === null) field.focus({ preventScroll: true });
  }

  function toNewest() {
    list.scrollTop = list.scrollHeight;
  }

  // The slide a note written now would be recorded against.
  function renderWhere() {
    const i = state.current;
    where.textContent = i < 0 ? '' : `On slide ${i + 1}: ${titleOf(slides[i])}`;
  }

  function dispatch() {
    const text = field.value.trim();
    if (text === '') return;
    add(text);
    field.value = '';
    render();
    toNewest();
    field.focus();
  }

  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      dispatch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  // ---- open and close ----

  const barButton = button('deck-jot-button', '', 'Jotted notes: write down what is raised (m)', () => toggle());
  barButton.append(icon('jot'));
  barButton.setAttribute('aria-label', 'Jotted notes');
  barButton.setAttribute('aria-pressed', 'false');

  const isOpen = () => !pane.hidden;

  function open() {
    if (!state.presenting) return;
    pane.hidden = false;
    barButton.setAttribute('aria-pressed', 'true');
    askToClear(false);
    renderWhere();
    render();
    toNewest();
    field.focus();
  }

  function close() {
    if (!isOpen()) return;
    pane.hidden = true;
    barButton.setAttribute('aria-pressed', 'false');
    editing = null;
    // the keys go back to the deck (a draft in the field stays for the next time)
    if (pane.contains(document.activeElement)) document.body.focus({ preventScroll: true });
  }

  const toggle = () => (isOpen() ? close() : open());

  document.addEventListener('deck:show', renderWhere);
  document.addEventListener('deck:present', (e) => { if (!e.detail.on) close(); });

  // m opens and closes the pane, and Esc closes it (and is not passed on, so it does not also stop presenting). Returns
  // whether it took the key. Typing in the pane never gets here: deck-keys.js leaves the keys of a text field alone.
  function onKey(e) {
    if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
      e.preventDefault();
      toggle();
      return true;
    }
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
      return true;
    }
    return false;
  }

  renderHead();
  return { barButton, isOpen, open, close, toggle, key: onKey, report };
}
