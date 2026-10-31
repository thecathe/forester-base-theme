// SPDX-License-Identifier: CC0-1.0
//
// \agenda (trees/meta/navigation.tree) writes an empty block that is filled here, from the same marks as the rest, with
// an outline of the deck: \agenda{here} the slides of the section the slide is in, \agenda{all} every unit of the talk with its
// sections inside, and a bare \agenda the sections only. While presenting, what is behind you is dimmed and where you
// are is bold (deck:show marks them; stopping unmarks them, since off the stage there is no "now").

export function installAgenda(deck) {
  const { root, slides, state } = deck;
  const { members, enclosing, titleOf } = deck.shape;
  const { el } = deck.ui;

  const items = [];

  const unitsOf = (section) => [...section.querySelectorAll(':scope > details > section[data-deck]')];
  // The first and last slide a unit covers, as indexes; null for a section with no slides.
  function rangeOf(unit) {
    if (unit.dataset.deck === 'slide') {
      const i = slides.indexOf(unit);
      return [i, i];
    }
    const inside = members.get(unit);
    return inside.length > 0 ? [inside[0], inside[inside.length - 1]] : null;
  }

  // A list of the units of a section: sections with their own list inside when `deep`, and slides
  // when `withSlides`. `skip` is a unit to leave out (the slide the outline is on). A part's own
  // divider is left out too (a slide titled like its section, laid out as a divider): the entry
  // for the section already goes to it.
  function outline(section, { withSlides, deep, skip }) {
    const list = el('ul', 'agenda-list');
    for (const unit of unitsOf(section)) {
      const isSection = unit.dataset.deck === 'section';
      const partDivider = !isSection && unit.dataset.layout === 'divider' && unit.dataset.title === section.dataset.title;
      const range = unit === skip || partDivider || (!isSection && !withSlides) ? null : rangeOf(unit);
      if (!range) continue;
      const item = el('li', isSection ? 'agenda-section' : 'agenda-slide');
      item.dataset.from = String(range[0]);
      item.dataset.to = String(range[1]);
      const link = el('a', '', titleOf(unit));
      link.href = `#slide-${range[0] + 1}`;
      item.append(link);
      if (isSection && deep) {
        const inner = outline(unit, { withSlides, deep, skip });
        if (inner.children.length > 0) item.append(inner);
      }
      list.append(item);
      items.push(item);
    }
    return list;
  }

  function build(block) {
    const host = block.closest('section[data-deck="slide"]');
    let list;
    if (block.classList.contains('agenda-here')) {
      const section = host && enclosing(host);
      if (section) list = outline(section, { withSlides: true, deep: false, skip: host });
    } else if (block.classList.contains('agenda-all')) {
      list = outline(root, { withSlides: true, deep: true });
      // A whole talk is long: as many columns as it takes at about twelve entries to a column, and a
      // smaller type for a very long one, so that it fits a slide.
      const n = list.querySelectorAll('li').length;
      block.style.setProperty('--agenda-cols', String(Math.min(5, Math.max(1, Math.ceil(n / 12)))));
      block.style.setProperty('--agenda-size', n > 72 ? '.56em' : n > 36 ? '.62em' : n > 24 ? '.72em' : '.86em');
      block.style.setProperty('--agenda-gap', n > 72 ? '.06em' : '.2em');
      // A section with more entries than a column holds has to run on into the next one (the others stay whole).
      for (const item of list.querySelectorAll(':scope > li')) {
        if (item.querySelectorAll('li').length > 12) item.classList.add('agenda-long');
      }
    } else {
      list = outline(root, { withSlides: false, deep: true });
    }
    if (list && list.children.length > 0) block.replaceChildren(list);
  }

  // Dim what is behind the slide on show and make bold the entry that holds it; nothing is marked off
  // the stage, where there is no "now".
  function mark() {
    for (const item of items) {
      const from = Number(item.dataset.from);
      const to = Number(item.dataset.to);
      item.classList.toggle('agenda-done', state.presenting && state.current > to);
      item.classList.toggle('agenda-current', state.presenting && state.current >= from && state.current <= to);
    }
  }

  for (const block of root.querySelectorAll('.agenda')) build(block);
  document.addEventListener('deck:show', mark);
  document.addEventListener('deck:present', (e) => { if (!e.detail.on) mark(); });
}
