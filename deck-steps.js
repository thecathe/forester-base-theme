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
//
// A fragment can say when it arrives (\fragmenti, \reveali, \flipi: data-step-from), and that overrides the above:
//  - a number is an exact press, and the ones written after it carry on from the largest press so far;
//  - "with" is the press of the fragment written just before it;
//  - "end" is after every other fragment of the slide (a press of its own, and in the order written when
//    there are several), and so is everything inside an "end" fragment, and a "with" after one;
//  - a fragment inside a \together (class "together") arrives with it, whatever else it says.
// A fragment that says nothing (data-step-from="") is in the order written, as if it had not been given.
//
// Most fragments are shown or hidden. One that has data-step-does is acted on instead: "open" opens the
// \reveal inside it, "turn" turns the \flip inside it, so what is on the stage follows the press.
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
  if (f.does) {
    // a \reveal that opens and a \flip that turns, rather than something that appears
    if (f.does === 'open') {
      const d = el.querySelector('details.reveal');
      if (d) d.open = shown;
    } else if (f.does === 'turn') {
      const c = el.querySelector('.flip-checkbox');
      if (c) c.checked = shown;
    }
    return;
  }
  el.classList.toggle('deck-hidden', !shown);
  if (f.passed !== undefined) {
    // The chevron goes when the next row arrives, the dimming when the next row that is not a \substep does
    // (so a row stays bright while its sub-steps are on).
    const dimAt = f.dimmed === undefined ? f.passed : f.dimmed;
    el.classList.toggle('deck-past', dimAt !== null && press >= dimAt);
    el.classList.toggle('deck-current', shown && !(f.passed !== null && press >= f.passed));
  }
}

// Puts the reveals and flips of `slide` that the steps drive at `press`: all closed and facing front at 0 (what the
// ordinary page has), all open and turned at the last press (what the overview shows of every step).
export function setActions(slide, press) {
  for (const f of stepsOf(slide).list) {
    if (f.does) setFragment(f, f.el, press);
  }
}

// The press each fragment of a slide arrives on, in the order written (see the rules above). The ones that come
// "at the end" are settled after all the others, so that they are after them whatever order they are written in.
function arrivals(slide) {
  const items = [...slide.querySelectorAll(FRAGMENTS)].map((el) => {
    const word = (el.dataset.stepFrom ?? '').trim();
    // a number, "with" or "end"; anything else (nothing, or a mistake the build has already reported) is in the order written
    const at = /^\d+$/.test(word) ? Number(word) : word === 'with' || word === 'end' ? word : undefined;
    return { el, at, up: null, together: el.parentElement.closest('.together'), late: false, from: 0 };
  });
  const itemOf = new Map(items.map((item) => [item.el, item]));
  let before = null;
  for (const item of items) {
    const outer = item.el.parentElement.closest(FRAGMENTS);
    item.up = outer ? itemOf.get(outer) : null;
    item.late = item.at === 'end' || !!item.up?.late || (item.at === 'with' && !!before?.late);
    before = item;
  }

  // Gives each of `group` a press, in the order written, after the press `start`; returns the last one given.
  const settle = (group, start) => {
    let counter = start;
    let previous = null;
    for (const item of group) {
      const { el, at, up, together } = item;
      if (together) item.from = itemOf.get(together).from;
      else if (typeof at === 'number') item.from = at;
      else if (at === 'with' && previous) item.from = previous.from;
      else if (at === undefined && up && !hasContentBefore(up.el, el)) item.from = up.from;
      else item.from = counter + 1;
      counter = Math.max(counter, item.from);
      previous = item;
    }
    return counter;
  };
  settle(items.filter((item) => item.late), settle(items.filter((item) => !item.late), 0));
  return items;
}

export function stepsOf(slide) {
  let s = stepCache.get(slide);
  if (!s) {
    const list = arrivals(slide).map(({ el, from }) => ({
      el,
      from,
      until: el.dataset.stepUntil === undefined ? null : Number(el.dataset.stepUntil),
      does: el.dataset.stepDoes,
    }));
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
