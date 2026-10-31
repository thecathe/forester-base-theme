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
//  - for each flip that turns on a click, a copy of the page with that flip, and no other, turned over: straight after the page where
//    it first shows (for the picture of a step, the page where that picture arrives, since the next step's picture takes its place and
//    its back would be lost), and for any other flip after the last page.
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
  const frames = ordered.map((press) => ({ press, turned: [] }));
  clickFlips(slide).forEach((flip, i) => {
    const host = flip.closest('.step-visual');
    const picture = host && list.find((f) => f.el === host);
    // after the page of its picture (and the copies of the flips before it in the same picture), or else at the end
    const at = picture ? frames.findLastIndex((frame) => frame.press === picture.from) : -1;
    frames.splice(at < 0 ? frames.length : at + 1, 0, { press: at < 0 ? count : picture.from, turned: [i] });
  });
  return frames;
}

// The flips of a slide that turn when they are clicked (and not those the steps turn), in the order of the page.
function clickFlips(el) {
  return [...el.querySelectorAll('.flip-checkbox')].filter((c) => !c.closest('[data-step-does]'));
}

// Sets a slide (or a copy of one, whose steps and flips are in the same order) to a page's state: `turned` says which of the
// flips that turn on a click are over. The flips that the steps turn are left as the press has them.
function showFrame(el, frame, list) {
  const els = el.querySelectorAll(FRAGMENTS);
  list.forEach((f, i) => setFragment(f, els[i], frame.press));
  for (const d of el.querySelectorAll('details.reveal')) d.open = true;
  clickFlips(el).forEach((c, i) => { c.checked = frame.turned.includes(i); });
  el.classList.add('deck-frame');
}

const STEP_CLASSES = ['deck-hidden', 'deck-past', 'deck-current'];

// What the first printed page says when the page is not the size the slides were made for, 1280 CSS pixels wide: the print dialog's
// Scale is not 100% (or its margins are not none). Nothing in a page can read the dialog (a script gets nothing at print time, and in
// Firefox a media query sees the window and a container query is not evaluated in a print), so the printed page measures itself:
// a warning as wide as the page minus 1280px (the width is `calc((1280px - 100%) * 1000)`, deck.css) is zero wide on a page of exactly
// 1280px and clipped to nothing, and as wide as the page on a page that is narrower, and the other way round for one that is wider. The
// pages are what the print preview shows, so it is seen before the print is made. The two are put in the first slide after the copies
// of the slides are made, so they are on the first page only.
const SCALE_WARNINGS = [
  ['above', '⚠ Print scale above 100%, or margins not None: set Scale to 100% and Margins to None, then print again.'],
  ['below', '⚠ Print scale below 100%: set Scale to 100%, then print again.'],
];

function scaleWarnings() {
  return SCALE_WARNINGS.map(([which, text]) => {
    const box = document.createElement('div');
    box.className = `deck-print-warn ${which}`;
    const words = document.createElement('span');
    words.textContent = text;
    box.append(words);
    return box;
  });
}

// A link to a slide (`#slide-3`, `#name/2`, which deck.js reads and the page does not have an element for) is, in the PDF of an engine that
// makes a link to a place in the same page into a jump (Chromium's does), a jump only when an element has the id the link names. Firefox
// keeps the page's address plus the fragment, whatever the ids. So while the page is printed each slide holds an empty element for each
// of its addresses, put in first (deck.js says which: `addressesOf(i)`), and taken away after. They are no size (deck.css), in the flow
// and not absolute: Chromium puts the jump to an element that is positioned absolutely on the wrong page (to slide 2 it went to page 3,
// to slide 3 to page 5), and a block with no size, first in a slide, moves nothing (the demo and the talk print the same, to the
// pixel, with and without them). An address the page already has an element for is left to that element.
function addressTargets(slide, addresses, taken) {
  const targets = [];
  for (const id of addresses) {
    if (taken.has(id) || document.getElementById(id)) continue;
    taken.add(id);
    const target = document.createElement('span');
    target.className = 'deck-print-target';
    target.id = id;
    targets.push(target);
  }
  slide.prepend(...targets);
  return () => targets.forEach((t) => t.remove());
}

// The title of a slide is an h1, as every title in a Forester page is, so a PDF's outline of bookmarks (Chromium builds one from the headings)
// would be flat. While the page is printed each slide's title says how deep it is (aria-level, which the outline follows): see
// `levelOf` below. A copy of a slide (a page for a state of it) is not a heading again, so that a slide is one bookmark, at its first page.
function outlineLevel(slide, level) {
  const title = slide.querySelector(':scope > details > summary h1');
  if (!title) return () => {};
  const was = title.getAttribute('aria-level');
  title.setAttribute('aria-level', String(level));
  return () => (was === null ? title.removeAttribute('aria-level') : title.setAttribute('aria-level', was));
}

// Takes over printing for the page: `slides` are the deck's slides, and `about` says what it needs of the deck:
//   isPresenting()   whether it is on the stage;
//   pageAfter(i)     a page to print after slide i, if there is one (the speaker notes, deck-notes.js), or null;
//   addressesOf(i)   the ids to answer to for slide i (see addressTargets);
//   levelOf(i)       how deep slide i is in the outline, 1 for the top;
//   followLinks()    sends the links to other trees where those trees lead, and returns what puts them back (deck-links.js).
export function installPrinting(slides, { isPresenting, pageAfter = () => null, addressesOf = () => [], levelOf = () => 1, followLinks = () => () => {} }) {
  let afterPrint = [];
  window.addEventListener('beforeprint', () => {
    if (isPresenting()) return; // the stage prints the slide on show, as it is (with its links already sent on)
    // Before the copies of the slides below are made, so that they have the links as they are printed.
    afterPrint.push(followLinks());
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
        for (const h of copy.querySelectorAll('h1, h2, h3, h4, h5, h6')) h.setAttribute('role', 'presentation');
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
  window.addEventListener('beforeprint', () => {
    if (isPresenting()) return;
    // after the copies of the slides were made (above), which therefore have none: a copy has no ids
    const taken = new Set();
    slides.forEach((slide, n) => {
      afterPrint.push(addressTargets(slide, addressesOf(n), taken));
      afterPrint.push(outlineLevel(slide, levelOf(n)));
    });
  });
  window.addEventListener('beforeprint', () => {
    if (isPresenting() || slides.length === 0) return;
    const warnings = scaleWarnings();
    slides[0].prepend(...warnings);
    afterPrint.push(() => warnings.forEach((w) => w.remove()));
  });
  window.addEventListener('afterprint', () => {
    for (const undo of afterPrint) undo();
    afterPrint = [];
  });
}
