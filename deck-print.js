// SPDX-License-Identifier: CC0-1.0
//
// Printing a deck page: a page for each state of a slide that has more than one (see printFrames). deck.js
// installs it once, saying which slides there are and whether the deck is being presented (when it is, the
// stage prints the slide on show, as it is).

import { FRAGMENTS, setFragment, stepsOf } from './deck-steps.js';

// Printing the page gives a page for each slide with everything on it shown. What is only there for a while
// (the picture of a \step) or only on the other side of a \flip would be lost that way, so a slide with such things
// prints as several pages, one for each state:
//  - for each step picture, the slide as it is just after that picture arrives;
//  - for each flip that turns on a press (\flipi), the slide just before and just after it turns;
//  - for the flips that turn on a click, a last page with them all turned over, the others showing their fronts.
// A \reveal is always printed open: what it hides is what the page is for, and it makes no page of its own. A slide with
// no step picture and no flip is one page, as before.
// The extra pages are copies of the slide, made for the printing and taken away after it.
function printFrames(slide) {
  const { list, count } = stepsOf(slide);
  const presses = new Set();
  for (const f of list) {
    if (f.el.matches('.step-visual')) presses.add(f.from);
    if (f.does === 'turn') {
      presses.add(f.from);
      presses.add(Math.max(0, f.from - 1));
    }
  }
  const ordered = [...presses].sort((a, b) => a - b);
  if (ordered.length === 0 || ordered[ordered.length - 1] < count) ordered.push(count);
  const frames = ordered.map((press) => ({ press, turned: false }));
  if ([...slide.querySelectorAll('.flip-checkbox')].some((c) => !c.closest('[data-step-does]'))) frames.push({ press: count, turned: true });
  return frames;
}

// Sets a slide (or a copy of one, whose steps are in the same order) to a page's state. The flips that the
// steps turn are left as the press has them.
function showFrame(el, frame, list) {
  const els = el.querySelectorAll(FRAGMENTS);
  list.forEach((f, i) => setFragment(f, els[i], frame.press));
  for (const d of el.querySelectorAll('details.reveal')) d.open = true;
  for (const c of el.querySelectorAll('.flip-checkbox')) {
    if (!c.closest('[data-step-does]')) c.checked = frame.turned;
  }
  el.classList.add('deck-frame');
}

const STEP_CLASSES = ['deck-hidden', 'deck-past', 'deck-current'];

// Takes over printing for the page: `slides` are the deck's slides, `isPresenting()` says whether it is on the stage, and
// `pageAfter(i)`, if there is one, gives a page to print after slide i (the speaker notes, deck-notes.js) or null.
export function installPrinting(slides, isPresenting, pageAfter = () => null) {
  let afterPrint = [];
  window.addEventListener('beforeprint', () => {
    if (isPresenting()) return; // the stage prints the slide on show, as it is
    slides.forEach((slide, n) => {
      // Put in first, so that the copies of the slide, which go in straight after it, come before it.
      const extra = pageAfter(n);
      if (extra) {
        slide.after(extra);
        afterPrint.push(() => extra.remove());
      }
      const frames = printFrames(slide);
      if (frames.length < 2) {
        // one page; a reveal on it is printed open
        const reveals = [...slide.querySelectorAll('details.reveal')];
        if (reveals.length > 0) {
          const was = reveals.map((d) => d.open);
          reveals.forEach((d) => { d.open = true; });
          afterPrint.push(() => reveals.forEach((d, i) => { d.open = was[i]; }));
        }
        return;
      }
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
    });
  });
  window.addEventListener('afterprint', () => {
    for (const undo of afterPrint) undo();
    afterPrint = [];
  });
}
