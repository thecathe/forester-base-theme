// SPDX-License-Identifier: CC0-1.0
//
// The "Go to" list in the toolbar: a select of the sections or of every slide, with two buttons to say which, and
// a choice that goes there. It follows the slide on show (deck:show). A section that holds content which is not
// presented is marked with a warning sign.
//
// Returns the element for the toolbar (deck-bar.js) to put in place.

export function installGoto(deck) {
  const { sectionList, members, titleOf, innermost, depthOf, warningOf, slides } = deck.shape;
  const { el, button } = deck.ui;
  const { state } = deck;

  let mode = 'sections';

  const label = el('span', 'deck-label', 'Go to');
  const select = el('select', 'deck-goto');
  select.setAttribute('aria-label', 'Go to');
  const modeSections = button('deck-mode', 'Sections', 'List the sections', () => setMode('sections'));
  const modeSlides = button('deck-mode', 'Slides', 'List every slide', () => setMode('slides'));
  const modes = el('span', 'deck-modes');
  modes.append(modeSections, modeSlides);
  const group = el('span', 'deck-group deck-jump');
  group.append(label, select, modes);

  const marked = (s) => (warningOf(s) ? '⚠ ' : '');

  // The list of places to jump to: the sections, or every slide.
  function fill() {
    select.textContent = '';
    const option = (value, text, disabled) => {
      const o = el('option', '', text);
      o.value = value;
      o.disabled = disabled;
      select.append(o);
    };
    // non-breaking: an ordinary space at the start of an option is collapsed away
    const indent = (n) => '\u00a0\u00a0'.repeat(n);
    if (mode === 'sections') {
      sectionList.forEach((s, k) => {
        const n = members.get(s).length;
        option(String(k), `${indent(depthOf(s))}${marked(s)}${titleOf(s)} (${n})`, n === 0);
      });
    } else {
      let shownIn = null;
      slides.forEach((slide, i) => {
        const s = innermost(i);
        if (s !== shownIn) {
          shownIn = s;
          option('', `${indent(depthOf(s))}— ${marked(s)}${titleOf(s)} —`, true);
        }
        option(String(i), `${indent(depthOf(s) + 1)}${i + 1}. ${titleOf(slide)}`, false);
      });
    }
    modeSections.setAttribute('aria-pressed', String(mode === 'sections'));
    modeSlides.setAttribute('aria-pressed', String(mode === 'slides'));
    sync();
  }

  function sync() {
    if (state.current < 0) return;
    select.value = mode === 'sections' ? String(sectionList.indexOf(innermost(state.current))) : String(state.current);
  }

  function setMode(next) {
    mode = next;
    fill();
  }

  select.addEventListener('change', () => {
    const v = Number(select.value);
    const index = mode === 'sections' ? members.get(sectionList[v])[0] : v;
    select.blur();
    if (index !== undefined) deck.show(index);
  });

  document.addEventListener('deck:show', sync);
  fill();

  return { element: group };
}
