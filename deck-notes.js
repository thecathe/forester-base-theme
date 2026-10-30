// SPDX-License-Identifier: CC0-1.0
//
// Speaker notes. \notes{...} (trees/meta/notes.tree) writes a hidden aside.deck-notes inside a slide, a section or
// the deck; this gathers the ones of each unit into one panel, and shows them when the notes are switched on.
//
// There is one switch, a class on <body> (deck-notes-on), and everything else follows it in the stylesheet:
//  - on the page, each slide's panel stands at its right (below it, in a narrow window), and the panel of a section
//    or of the deck stands under its heading; the table of contents, which would be in the way, is hidden;
//  - while presenting, a column at the right of the stage shows the notes of the slide on show, and the stage is
//    narrower to leave room for it. A section's notes show with its first slide, above that slide's own;
//  - printing follows the switch too (deck.css).
// The switch is not remembered: a page always opens with the notes hidden.
//
// deck.js tells this which slide is on show with a 'deck:show' event, and hears of a change with 'deck:notes'.

// A unit's own notes: for a slide, every note inside it; for a section or the deck, the ones written directly in it.
function notesOf(unit) {
  return [...unit.querySelectorAll(unit.dataset.deck === 'slide' ? '.deck-notes' : ':scope > details > .deck-notes')];
}

const LABELS = { slide: 'Notes', section: 'Notes for the section', deck: 'Notes for the talk' };

// `slides` are the deck's slides, `sectionsOf[i]` the deck and sections around slide i (outermost first) and
// `members` the slides each of them holds. `el`, `button` and `icon` are deck.js's small builders.
// Returns what deck.js needs to place: `has`, the buttons (`pageItem`, for the deck's metadata line, and `barButton`,
// for the toolbar), `toggle()` and `stageWidth()`, the room the column takes at the right of the stage.
export function installNotes({ root, slides, sectionsOf, members, titleOf, el, button, icon }) {
  const panels = new Map(); // unit -> the panel holding its notes
  const units = [root, ...root.querySelectorAll('section[data-deck="section"]'), ...slides];
  for (const unit of units) {
    const own = notesOf(unit);
    if (own.length === 0) continue;
    const panel = el('div', 'deck-notes-panel');
    panel.append(el('div', 'deck-notes-label', LABELS[unit.dataset.deck]));
    for (const note of own) {
      note.hidden = false; // hidden in the markup, so that a page without deck.css never shows it
      panel.append(note);
    }
    const heading = unit.querySelector(':scope > details > summary');
    if (unit.dataset.deck === 'slide') unit.append(panel);
    else if (heading) heading.after(panel);
    else unit.prepend(panel);
    panels.set(unit, panel);
  }
  if (panels.size === 0) return { has: false };

  // ---- the switch ----

  let on = false;
  const toggleTitle = 'Show or hide the speaker notes (n)';
  const pageButton = button('deck-present', 'Notes', toggleTitle, () => toggle());
  const barButton = button('deck-notes-button', '', toggleTitle, () => toggle());
  barButton.append(icon('notes'));
  barButton.setAttribute('aria-label', 'Speaker notes');
  const pageItem = el('li', 'meta-item');
  pageItem.append(pageButton);

  function toggle(value = !on) {
    on = value;
    document.body.classList.toggle('deck-notes-on', on);
    for (const b of [pageButton, barButton]) b.setAttribute('aria-pressed', String(on));
    document.dispatchEvent(new CustomEvent('deck:notes', { detail: { on } }));
  }
  pageButton.setAttribute('aria-pressed', 'false');
  barButton.setAttribute('aria-pressed', 'false');

  // ---- the column beside the stage ----

  const stage = el('div', 'deck-notes-stage');
  stage.setAttribute('aria-label', 'Speaker notes');
  document.body.append(stage);

  // The notes that go with slide i: those of each section that begins with it (the deck's, on the first slide),
  // outermost first, then the slide's own.
  const groupsFor = (i) => [...sectionsOf[i].filter((s) => members.get(s)[0] === i), slides[i]]
    .filter((unit) => panels.has(unit))
    .map((unit) => ({ unit, notes: [...panels.get(unit).querySelectorAll('.deck-notes')] }));

  document.addEventListener('deck:show', (e) => {
    stage.replaceChildren();
    const groups = groupsFor(e.detail.index);
    for (const { unit, notes } of groups) {
      const group = el('div', 'deck-notes-group');
      // A section's notes say whose they are; the slide's own are what the column is for.
      if (unit.dataset.deck !== 'slide') group.append(el('div', 'deck-notes-label', `${LABELS[unit.dataset.deck]}: ${titleOf(unit)}`));
      for (const note of notes) group.append(note.cloneNode(true));
      stage.append(group);
    }
    if (groups.length === 0) stage.append(el('div', 'deck-notes-none', 'No notes for this slide.'));
    stage.scrollTop = 0;
  });

  return { has: true, pageItem, barButton, toggle, stageWidth: () => stage.offsetWidth };
}
