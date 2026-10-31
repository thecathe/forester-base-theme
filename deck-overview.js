// SPDX-License-Identifier: CC0-1.0
//
// The overview (key o, or the grid button) shows every slide at once, small, with every step shown; arrows move between
// them, enter or a click goes to one, escape or o comes back to where you were. It reuses the stage's own look: every
// slide is given the class of the one on show, and the stylesheet scales them down.
//
// It is a mode of the stage, not a view beside it: while it is open `current` does not say what is on show, so deck.js
// asks it to leave (leave()) before every move and when presenting stops. It owns `deck.state.overview`.
//
// Returns what the rest needs: open(), leave(stay), toggle(), and key(e), the keys while it is open (deck-keys.js).

import { setActions, stepsOf } from './deck-steps.js';

export function installOverview(deck) {
  const { slides, last, state } = deck;
  const { sectionList, sectionsOf, titleOf, warningOf } = deck.shape;

  let selected = 0;

  // Every slide takes the class of the one on show, and every section the class of those around it,
  // so the stage's own rules lay each one out; deck.css scales them into a grid.
  function open() {
    if (!state.presenting || state.overview) return;
    state.overview = true;
    selected = state.current;
    document.body.classList.add('overview');
    deck.bar.hideNotice();
    for (const s of sectionList) {
      s.classList.add('in-chain');
      const d = s.querySelector(':scope > details');
      if (d) d.open = true;
    }
    slides.forEach((slide, i) => {
      setActions(slide, stepsOf(slide).count);
      slide.classList.add('current');
      slide.classList.toggle('deck-warned', sectionsOf[i].some((s) => warningOf(s)));
      slide.dataset.n = String(i + 1);
      slide.title = `${i + 1}. ${titleOf(slide)}`;
      const d = slide.querySelector(':scope > details');
      if (d) d.open = true;
    });
    slides[selected].classList.add('overview-selected');
    slides[selected].scrollIntoView({ block: 'center' });
  }

  // Back to the page as it was, with nothing of the overview left on it. Callers that go somewhere
  // call show() next; with `stay`, this puts the slide you came from back on show.
  function leave(stay = false) {
    if (!state.overview) return;
    state.overview = false;
    document.body.classList.remove('overview');
    for (const slide of slides) {
      slide.classList.remove('current', 'deck-warned', 'overview-selected');
      slide.removeAttribute('data-n');
      slide.removeAttribute('title');
    }
    for (const s of sectionList) s.classList.remove('in-chain');
    if (stay) deck.show(state.current, state.step);
  }

  const toggle = () => (state.overview ? leave(true) : open());

  function select(i) {
    slides[selected].classList.remove('overview-selected');
    selected = i;
    slides[selected].classList.add('overview-selected');
    slides[selected].scrollIntoView({ block: 'nearest' });
  }

  // How many slides are in a row of the grid, for the up and down arrows.
  function columns() {
    const top = slides[0].getBoundingClientRect().top;
    return Math.max(1, slides.filter((s) => Math.abs(s.getBoundingClientRect().top - top) < 2).length);
  }

  function key(e) {
    let to = selected;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (k) {
      case 'ArrowRight':
      case 'l': to++; break;
      case 'ArrowLeft':
      case 'h': to--; break;
      case 'ArrowDown':
      case 'j': to += columns(); break;
      case 'ArrowUp':
      case 'k': to -= columns(); break;
      case 'Home': to = 0; break;
      case 'End': to = last; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        deck.show(selected, selected === state.current ? state.step : 0);
        return;
      case 'Escape':
      case 'o':
        e.preventDefault();
        leave(true);
        return;
      case 'f':
        deck.toggleFullscreen();
        break;
      default: return;
    }
    e.preventDefault();
    select(Math.min(last, Math.max(0, to)));
  }

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => {
      if (state.overview) deck.show(i, i === state.current ? state.step : 0);
    });
  });

  return { open, leave, toggle, key };
}
