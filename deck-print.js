// SPDX-License-Identifier: CC0-1.0
//
// Printing a deck page: a page for each state of a slide that has more than one (see printFrames). deck.js
// installs it once, saying which slides there are and whether the deck is being presented (when it is, the
// stage prints the slide on show, as it is).

import { FRAGMENTS, setFragment, stepsOf } from './deck-steps.js';

// Printing the page gives a page for each slide with everything on it shown. A slide with something that
// is only there for a while (the picture of a \step) or only when asked for (a \reveal, a \flip) would
// lose it that way, so it prints as several pages, one for each state: for each step picture, the slide
// as it is just after that picture arrives; and, if it has a reveal or a flip, a last page with them all
// open, the others having them all closed. A slide with none of these prints as one page, as before.
// The extra pages are copies of the slide, made for the printing and taken away after it.
function printFrames(slide) {
  const { list, count } = stepsOf(slide);
  const presses = [...new Set(list.filter((f) => f.el.matches('.step-visual')).map((f) => f.from))].sort((a, b) => a - b);
  if (presses.length === 0 || presses[presses.length - 1] < count) presses.push(count);
  const frames = presses.map((press) => ({ press, open: false }));
  if (slide.querySelector('details.reveal, .flip-checkbox')) frames.push({ press: count, open: true });
  return frames;
}

// Sets a slide (or a copy of one, whose steps are in the same order) to a page's state.
function showFrame(el, frame, list) {
  const els = el.querySelectorAll(FRAGMENTS);
  list.forEach((f, i) => setFragment(f, els[i], frame.press));
  for (const d of el.querySelectorAll('details.reveal')) d.open = frame.open;
  for (const c of el.querySelectorAll('.flip-checkbox')) c.checked = frame.open;
  el.classList.add('deck-frame');
}

const STEP_CLASSES = ['deck-hidden', 'deck-past', 'deck-current'];

// Takes over printing for the page: `slides` are the deck's slides, `isPresenting()` says whether it is on the stage.
export function installPrinting(slides, isPresenting) {
  let afterPrint = [];
  window.addEventListener('beforeprint', () => {
    if (isPresenting()) return; // the stage prints the slide on show, as it is
    for (const slide of slides) {
      const frames = printFrames(slide);
      if (frames.length < 2) continue;
      const { list } = stepsOf(slide);
      const saved = {
        classes: list.map((f) => STEP_CLASSES.map((c) => f.el.classList.contains(c))),
        open: [...slide.querySelectorAll('details.reveal')].map((d) => d.open),
        checked: [...slide.querySelectorAll('.flip-checkbox')].map((c) => c.checked),
      };
      const copies = frames.slice(1).map(() => slide.cloneNode(true));
      showFrame(slide, frames[0], list);
      copies.forEach((copy, i) => {
        for (const e of copy.querySelectorAll('[id]')) e.removeAttribute('id');
        copy.removeAttribute('id');
        showFrame(copy, frames[i + 1], list);
      });
      slide.after(...copies);
      afterPrint.push(() => {
        for (const copy of copies) copy.remove();
        slide.classList.remove('deck-frame');
        list.forEach((f, i) => STEP_CLASSES.forEach((c, j) => f.el.classList.toggle(c, saved.classes[i][j])));
        slide.querySelectorAll('details.reveal').forEach((d, i) => { d.open = saved.open[i]; });
        slide.querySelectorAll('.flip-checkbox').forEach((c, i) => { c.checked = saved.checked[i]; });
      });
    }
  });
  window.addEventListener('afterprint', () => {
    for (const undo of afterPrint) undo();
    afterPrint = [];
  });
}
