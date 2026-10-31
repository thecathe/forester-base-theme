// SPDX-License-Identifier: CC0-1.0
//
// The keyboard, and the list of keys. KEY_TABLE is the one list of the key bindings: the ? overlay and a \keys block
// (trees/meta/navigation.tree) both draw from it, so a change to a key is a change to the handler below and to the table.
//
// The ? button (or the key) lays the key bindings over the slide: they go away on Esc, which that press consumes, on a
// click anywhere (full screen takes the first Esc itself), or 3 seconds after the next key, which does its usual work.
//
// A click with the mouse on a control inside a slide (a \flip's checkbox, a \reveal's summary, a link) moves the keyboard
// focus to it, and then the keys are the control's, so the deck would stop answering until you clicked somewhere else.
// So the focus is let go once the click has done its work, as the toolbar's buttons do.

import { stepsOf } from './deck-steps.js';

// The key bindings, as shown by the ? overlay and \keys: groups of [keys, what they do].
const KEY_TABLE = [
  ['Slides and steps', [
    [['→', '↓', 'Space', 'Enter', 'PgDn'], 'Next step, or the next slide when there are none left'],
    [['←', '↑', 'PgUp', 'Shift+Space'], 'Back a step, or to the slide before, shown complete'],
    [['l'], 'Next slide, from its first step'],
    [['h'], 'Previous slide, from its first step'],
    [['j'], 'Next step of this slide, and no further'],
    [['k'], 'Previous step of this slide'],
    [['Home', 'End'], 'First slide; last slide, complete'],
  ]],
  ['Sections', [
    [[']', 'i'], 'Start of the next section'],
    [['[', 'u'], 'Start of this section, or of the one before'],
  ]],
  ['Views', [
    [['o'], 'Overview of every slide (there, arrows or h j k l move, Enter goes to one)'],
    [['f'], 'Full screen'],
    [['n'], 'Show or hide the speaker notes (on the page too; the Notes button does the same)'],
    [['?'], 'This list'],
    [['Esc'], 'Closes this list or the overview; then leaves full screen; then stops presenting'],
  ]],
  ['Pointer', [
    [['Wheel', 'Trackpad'], 'Back and forward, once for each flick'],
    [['Click'], 'A progress bar segment goes there; in the overview a slide goes there; on this list, closes it'],
  ]],
];
const HELP_MS = 3000;

const KEYS_NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', 'Enter']);
const KEYS_PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

// KEY_TABLE as elements: a group is a title and rows of keys and what they do.
function keysTable(el) {
  const table = el('div', 'keys-table');
  for (const [title, rows] of KEY_TABLE) {
    const group = el('div', 'keys-group');
    group.append(el('div', 'keys-title', title));
    for (const [keys, what] of rows) {
      const row = el('div', 'keys-row');
      const cap = el('span', 'keys-caps');
      keys.forEach((k) => cap.append(el('kbd', '', k)));
      row.append(cap, el('span', 'keys-what', what));
      group.append(row);
    }
    table.append(group);
  }
  return table;
}

// The ? overlay. Returns isOpen(), show(), hide(), toggle(), and key(e): the help's share of a key press, which is
// true when it took the key (Esc while open, which must not also stop presenting; ?). It goes away when presenting stops.
export function installHelp(deck) {
  const { el } = deck.ui;

  const box = el('div', 'deck-help');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Keyboard shortcuts');
  box.hidden = true;
  const panel = el('div', 'deck-help-panel');
  panel.append(
    el('div', 'deck-help-title', 'Keyboard shortcuts'),
    keysTable(el),
    el('div', 'deck-help-note', `Esc closes this; so does a click anywhere, or ${HELP_MS / 1000} seconds after the next key.`),
  );
  box.append(panel);
  box.addEventListener('click', () => hide());
  document.body.append(box);

  let timer = 0;
  const isOpen = () => !box.hidden;
  function show() {
    clearTimeout(timer);
    timer = 0;
    box.hidden = false;
  }
  function hide() {
    clearTimeout(timer);
    timer = 0;
    box.hidden = true;
  }
  const toggle = () => (isOpen() ? hide() : show());

  function key(e) {
    if (isOpen()) {
      // Esc closes the list and is not passed on, so it does not also stop presenting. Any other key
      // does its usual work, and the first one that is not a bare modifier starts the countdown.
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
        return true;
      }
      if (!timer && e.key !== '?' && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        timer = setTimeout(hide, HELP_MS);
      }
    }
    if (e.key === '?') {
      e.preventDefault();
      toggle();
      return true;
    }
    return false;
  }

  document.addEventListener('deck:present', (e) => { if (!e.detail.on) hide(); });

  return { isOpen, show, hide, toggle, key };
}

export function installKeys(deck) {
  const { root, slides, last, state, notes } = deck;
  const { el } = deck.ui;

  for (const block of root.querySelectorAll('.deck-keys')) block.replaceChildren(keysTable(el));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches('input, textarea, select, [contenteditable], ninja-keys'))) return;
    const isN = e.key === 'n' || e.key === 'N';
    if (!state.presenting) {
      // On the page the one key is n, for the notes.
      if (isN && notes.has && !e.repeat) {
        e.preventDefault();
        notes.toggle();
      }
      return;
    }
    if (deck.help.key(e)) return;
    if (state.overview) {
      deck.overview.key(e);
      return;
    }
    // A focused link or button keeps the keys that activate it.
    const activates = e.target instanceof Element && e.target.closest('a, button, summary') !== null;
    let handled = true;
    if (KEYS_NEXT.has(e.key) || (e.key === ' ' && !e.shiftKey)) {
      if ((e.key === ' ' || e.key === 'Enter') && activates) return;
      deck.next();
    } else if (KEYS_PREV.has(e.key) || (e.key === ' ' && e.shiftKey)) {
      if (e.key === ' ' && activates) return;
      deck.prev();
    } else if (e.key === '[') deck.prevSection();
    else if (e.key === ']') deck.nextSection();
    else if (e.key === 'Home') deck.show(0);
    else if (e.key === 'End') deck.show(last, stepsOf(slides[last]).count);
    else if (e.key === 'Escape') deck.exit();
    else if (e.key === 'f' || e.key === 'F') deck.toggleFullscreen();
    else if (e.key === 'o' || e.key === 'O') deck.overview.open();
    else if (isN) { if (notes.has && !e.repeat) notes.toggle(); }
    // The same moves on the home row: h and l are the slide before and after (from its first step),
    // j and k the next and previous step of this slide and no further, u and i the sections.
    else if (e.key === 'l' || e.key === 'L') { if (state.current < last) deck.show(state.current + 1); }
    else if (e.key === 'h' || e.key === 'H') { if (state.current > 0) deck.show(state.current - 1); }
    else if (e.key === 'j' || e.key === 'J') { if (state.step < stepsOf(slides[state.current]).count) deck.show(state.current, state.step + 1); }
    else if (e.key === 'k' || e.key === 'K') { if (state.step > 0) deck.show(state.current, state.step - 1); }
    else if (e.key === 'i' || e.key === 'I') deck.nextSection();
    else if (e.key === 'u' || e.key === 'U') deck.prevSection();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
  });

  // A click that came from the keyboard (detail is 0: space on a control you tabbed to) is left alone.
  document.addEventListener('click', (e) => {
    if (!state.presenting || e.detail === 0) return;
    setTimeout(() => {
      const a = document.activeElement;
      if (a instanceof Element && a.matches('input[type="checkbox"], summary, a, button') && a.closest('section[data-deck="slide"]')) a.blur();
    });
  });
}
