// SPDX-License-Identifier: CC0-1.0
//
// The steps of a slide, which deck.js (the stage) and deck-print.js (the printed pages) both use: what arrives
// on which press, and how a fragment looks at a given press. It reads the page and nothing else, so it
// has no idea which slide is on show or whether anything is being presented.
//
// A fragment is an element with data-step-from, a .fragment, or an item of a list inside an .incremental
// (see trees/meta/fragments.tree). stepsOf(slide) works out, once for each slide, the press each one arrives
// on (from), the press it goes away on if it does (until), and for the text of a \step the press at which
// its chevron goes (passed) and at which it is dimmed (dimmed). setFragment() applies one press to one
// fragment.

// The steps of a slide, worked out once. A fragment (see trees/meta/fragments.tree) is anything
// with data-step-from, a .fragment, or an item of a list inside an .incremental. The ones that
// do not say which step they arrive on are numbered in the order they are written, after
// whichever step came before, with two exceptions:
//  - a fragment that is the first thing inside another fragment arrives with it, so that an item of
//    a list never shows up empty before the step it holds (see hasContentBefore);
//  - the picture of a \step (in \steps, or among the \pair of a \pairs) goes away when the next row
//    arrives, whether that is a \pair or a \step, so a step's picture is only ever there until then.
//    The last row has no next one: it stays, unless a \clearstep ends the block (see below).
export const FRAGMENTS = '[data-step-from], .fragment, .incremental > :is(ul, ol) > li';
const stepCache = new WeakMap();

// Whether anything is shown inside `outer` before `inner`: text, or a picture or a control. (What is
// before may well be a fragment too, still waiting: the question is whether `outer` is empty
// without `inner`, which it is not if an earlier fragment is part of it.)
function hasContentBefore(outer, inner) {
  const range = document.createRange();
  range.setStart(outer, 0);
  range.setEndBefore(inner);
  return range.toString().trim() !== '' || range.cloneContents().querySelector('img, svg, canvas, video, iframe, object, input') !== null;
}

// A fragment as it is at a press: shown or not and, for the text of a \step, whether it is the one we are
// on (deck-current: a chevron for its bullet) or one we have gone past (deck-past: dimmed). Used for the stage
// and for a printed page of a slide (showFrame).
export function setFragment(f, el, press) {
  const shown = press >= f.from && (f.until === null || press < f.until);
  el.classList.toggle('deck-hidden', !shown);
  if (f.passed !== undefined) {
    // The chevron goes when the next row arrives, the dimming when the next row that is not a \substep does
    // (so a row stays bright while its sub-steps are on).
    const dimAt = f.dimmed === undefined ? f.passed : f.dimmed;
    el.classList.toggle('deck-past', dimAt !== null && press >= dimAt);
    el.classList.toggle('deck-current', shown && !(f.passed !== null && press >= f.passed));
  }
}

export function stepsOf(slide) {
  let s = stepCache.get(slide);
  if (!s) {
    let counter = 0;
    const arrives = new Map();
    const list = [...slide.querySelectorAll(FRAGMENTS)].map((el) => {
      let from;
      if (el.dataset.stepFrom !== undefined) {
        from = Number(el.dataset.stepFrom) || 0;
      } else {
        const outer = el.parentElement.closest(FRAGMENTS);
        from = outer && arrives.has(outer) && !hasContentBefore(outer, el) ? arrives.get(outer) : counter + 1;
      }
      arrives.set(el, from);
      counter = Math.max(counter, from);
      return { el, from, until: el.dataset.stepUntil === undefined ? null : Number(el.dataset.stepUntil) };
    });
    const byEl = new Map(list.map((f) => [f.el, f]));
    // The press at which the row after a \step's row arrives: its picture goes then, and its text is passed.
    const nextRow = (el, skipSubsteps = false) => {
      let row = el.parentElement.nextElementSibling;
      while (skipSubsteps && row?.matches('.substep')) row = row.nextElementSibling;
      const next = row && (row.matches('.fragment') ? row : row.querySelector('.fragment'));
      return next && byEl.has(next) ? byEl.get(next).from : null;
    };
    for (const f of list) {
      if (f.el.matches('.step-visual')) {
        const at = nextRow(f.el);
        if (at !== null) f.until = at;
      } else if (f.el.matches('.step-text')) {
        f.passed = nextRow(f.el);
        if (!f.el.parentElement.matches('.substep')) f.dimmed = nextRow(f.el, true);
      }
    }
    // A \clearstep ends the last row of its block when the first fragment after the block arrives: the
    // last row has no next row to do it, so its picture would stay to the end of the slide.
    for (const mark of slide.querySelectorAll('.pairs > .clear-step, .steps > .clear-step')) {
      const block = mark.parentElement;
      const last = mark.previousElementSibling;
      const after = list.find((f) => !block.contains(f.el) && (block.compareDocumentPosition(f.el) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (!after || !last?.matches('.step')) continue;
      const visual = last.querySelector(':scope > .step-visual');
      if (visual) byEl.get(visual).until = after.from;
      byEl.get(last.querySelector(':scope > .step-text')).passed = after.from;
      // the rows still waiting to be dimmed (the last, and any row whose sub-steps run to the end) go with it
      for (const text of block.querySelectorAll(':scope > .step > .step-text')) {
        const f = byEl.get(text);
        if (f.dimmed === null || (f.dimmed === undefined && f.passed === null)) f.dimmed = after.from;
      }
    }
    s = { list, count: Math.max(0, ...list.map((f) => Math.max(f.from, f.until ?? 0))) };
    stepCache.set(slide, s);
  }
  return s;
}
