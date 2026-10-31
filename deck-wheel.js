// SPDX-License-Identifier: CC0-1.0
//
// Scrolling the wheel or trackpad moves through the steps and slides, one move for each flick, as the arrow keys do.
//
// A trackpad sends a stream of small events, and keeps sending decaying ones (momentum) for a second
// or so after the fingers lift; a mouse wheel sends one large event for each notch, with nothing in
// between. So a flick is told from the one before it by any of: a pause in the events (which also
// makes every notch of a wheel a flick of its own), the direction reversing (at once, with only a
// short cooldown, so changing your mind is quick), or a push that is clearly stronger than the
// momentum it lands on. The numbers are here to be tuned.

const WHEEL = {
  pause: 100,    // ms without events: a new flick
  push: 40,      // px of scrolling that make a move
  surge: 25,     // a new push over momentum: at least this many px in one event, and over twice the last one
  again: 250,    // ms before a surge in the same direction may move again
  reversing: 60, // ms before the opposite direction may move
};

export function installWheel(deck) {
  const { state } = deck;
  const wheel = { last: -Infinity, lastDelta: 0, dir: 0, pushed: 0, spent: false, moved: -Infinity };
  document.addEventListener('wheel', (e) => {
    if (!state.presenting || state.overview || e.ctrlKey || e.metaKey) return; // ctrl and wheel is the browser's zoom; the overview scrolls
    // Long notes scroll in their column; a wheel there is theirs.
    const column = e.target instanceof Element && e.target.closest('.deck-notes-stage');
    if (column && column.scrollHeight > column.clientHeight) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    if (d === 0) return;
    const sign = Math.sign(d);
    const t = e.timeStamp;
    const fresh = t - wheel.last > WHEEL.pause;
    const reversed = !fresh && sign !== wheel.dir;
    const surged = !fresh && !reversed && wheel.spent && Math.abs(d) >= WHEEL.surge && Math.abs(d) > 2 * Math.abs(wheel.lastDelta);
    if (fresh || reversed || surged) {
      wheel.spent = false;
      wheel.pushed = 0;
    }
    wheel.last = t;
    wheel.lastDelta = d;
    wheel.dir = sign;
    if (wheel.spent) return;
    wheel.pushed += d;
    if (Math.abs(wheel.pushed) < WHEEL.push) return;
    const wait = reversed ? WHEEL.reversing : surged ? WHEEL.again : 0;
    if (t - wheel.moved < wait) return;
    wheel.spent = true;
    wheel.moved = t;
    if (wheel.pushed > 0) deck.next();
    else deck.prev();
  }, { passive: false });
}
