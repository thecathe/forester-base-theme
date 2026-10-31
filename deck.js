// SPDX-License-Identifier: CC0-1.0
//
// Deck mode: presents a deck page. Loaded on deck pages only (see deck.xsl), as a plain script of
// its own and not part of the bundled forester.js, so it needs no build step.
//
// It works out nothing about the deck's shape. deck.xsl wrote that into the page when it was built
// (data-deck="deck|section|slide" on each unit, data-slug and data-title), deck-shape.js reads it, and what this adds is
// the state: which slide is on show and how far through its steps. This file is the conductor: it keeps the state, makes
// the moves (show, enter, exit, next, prev, the section moves, full screen), follows the page's address, and installs the
// parts, each in a file of its own. A part is handed `deck`, the object below, and uses it in two ways:
//  - it asks `deck` to do things: deck.show(i), deck.next(), deck.exit(), deck.toggleFullscreen();
//  - it is told what happened by an event on the document, and does its own work: 'deck:show' ({index, step}: a slide is on
//    show, at that step), 'deck:present' ({on}: presenting started or stopped), and the notes' own 'deck:notes' ({on}).
// `deck.state` is the state: {current, step, presenting, overview}. Only this file writes the first three, and only
// the overview writes `overview`. A part reads them, and never keeps its own copy of them.
//
// The parts:
//   deck-shape.js     the deck's shape, read from the marks: sections, titles, addresses (deck.shape)
//   deck-steps.js     what arrives on which press of a slide: fragments, reveals, flips, \pairs and \steps
//   deck-notes.js     speaker notes: a switch of their own (the Notes button, key n), a column beside the stage (deck.notes)
//   deck-agenda.js    \agenda outlines, dimmed behind you and bold where you are
//   deck-footers.js   \footer, on each slide, with the \var-... words filled in
//   deck-present.js   the Present and Resume buttons on the page
//   deck-bar.js       the toolbar, the error and notice strips, the room the stage has (deck.bar); deck-goto.js is its go-to list
//   deck-keys.js      the keys, the ? help (deck.help) and the list of keys \keys shows
//   deck-wheel.js     the wheel and trackpad, one move for each flick
//   deck-overview.js  every slide at once, small (deck.overview): a mode of the stage, asked to leave before every move
//   deck-links.js     links to other trees go where the tree leads, while presenting and printing (deck.links)
//   deck-print.js     the printed pages: a page for each state of a slide, the notes, the PDF's links
//   deck-ui.js        the builders they share (deck.ui)
// A part that is in the way of another is told by this file, not by the part: the overview leaves before a move and when
// presenting stops, and the bar lays the stage out and clears its error when presenting is entered.
//
// The order they are installed in matters in two places, and is the order below. The notes go first, so that what they
// add to the body and to the slides comes before what the others add. The toolbar goes after the agenda: it checks what
// fits when it hears 'deck:show', and by then the agenda has been marked (it is bold where you are, which can change what fits).
//
// Printing the page (deck-print.js) gives a page for each state of a slide that has more than one, and, with the
// notes on, a page of notes after a slide that has some.

import { layoutSteps, setActions, setFragment, stepsOf } from './deck-steps.js';
import { installPrinting } from './deck-print.js';
import { installNotes } from './deck-notes.js';
import { readShape, wrapStrayText } from './deck-shape.js';
import { button, el, icon } from './deck-ui.js';
import { installAgenda } from './deck-agenda.js';
import { installFooters } from './deck-footers.js';
import { installPresent } from './deck-present.js';
import { installBar } from './deck-bar.js';
import { installHelp, installKeys } from './deck-keys.js';
import { installWheel } from './deck-wheel.js';
import { installOverview } from './deck-overview.js';
import { installLinks } from './deck-links.js';

function init() {
  const root = document.querySelector('article > section[data-deck="deck"]');
  if (!root) return;
  const shape = readShape(root);
  const { slides, last, sectionsOf, sectionStarts } = shape;
  if (slides.length === 0) return;
  wrapStrayText(shape.sectionList);

  const state = { current: -1, step: 0, presenting: false, overview: false };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const deck = {
    root, slides, last, shape, state, ui: { el, icon, button },
    show, enter, exit, next, prev, nextSection, prevSection, enterFullscreen, toggleFullscreen,
    // set as the parts are installed (below): notes, bar, help, overview, links
  };

  // ---- moving ----

  function applyStep() {
    for (const f of stepsOf(slides[state.current]).list) setFragment(f, f.el, state.step);
  }

  function clearShown() {
    if (state.current < 0) return;
    slides[state.current].classList.remove('current', 'deck-warned');
    sectionsOf[state.current].forEach((s) => s.classList.remove('in-chain'));
  }

  function show(index, newStep = 0, writeAddress = true) {
    deck.overview.leave();
    clearShown();
    state.current = index;
    state.step = newStep;
    sectionsOf[index].forEach((s) => {
      s.classList.add('in-chain');
      const d = s.querySelector(':scope > details');
      if (d) d.open = true;
    });
    const slide = slides[index];
    slide.classList.add('current');
    const d = slide.querySelector(':scope > details');
    if (d) d.open = true;
    slide.scrollTop = 0;
    applyStep();
    emit('deck:show', { index, step: state.step });
    if (writeAddress) history.replaceState(null, '', `#slide-${index + 1}`);
  }

  function enter(index, newStep = 0, writeAddress = true) {
    if (!state.presenting) {
      state.presenting = true;
      document.body.classList.add('presenting');
      document.body.classList.toggle('deck-fullscreen', !!document.fullscreenElement);
      emit('deck:present', { on: true });
    }
    deck.bar.clearError();
    deck.bar.layout();
    show(index, newStep, writeAddress);
  }

  function exit() {
    if (!state.presenting) return;
    deck.overview.leave();
    state.presenting = false;
    document.body.classList.remove('presenting');
    emit('deck:present', { on: false });
    clearShown();
    for (const slide of slides) setActions(slide, 0);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
  }

  function next() {
    if (state.step < stepsOf(slides[state.current]).count) show(state.current, state.step + 1);
    else if (state.current < last) show(state.current + 1, 0);
  }

  // The start of the next section, and the start of this one (or, from its first slide, of the one
  // before). Where a section begins is what the build marked; see sectionStarts.
  function nextSection() {
    const to = sectionStarts.find((i) => i > state.current);
    if (to !== undefined) show(to);
  }
  function prevSection() {
    const before = sectionStarts.filter((i) => i < state.current);
    if (before.length > 0) show(before[before.length - 1]);
    else if (state.current > 0 || state.step > 0) show(0);
  }

  // Going back lands on the earlier slide with everything on it shown.
  function prev() {
    if (state.step > 0) show(state.current, state.step - 1);
    else if (state.current > 0) show(state.current - 1, stepsOf(slides[state.current - 1]).count);
  }

  function enterFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  }
  document.addEventListener('fullscreenchange', () => {
    const full = !!document.fullscreenElement;
    document.body.classList.toggle('deck-fullscreen', full);
    // Leaving full screen can leave the keyboard outside the page, which would swallow the next Esc.
    if (!full && state.presenting) {
      window.focus();
      document.body.focus({ preventScroll: true });
    }
    deck.bar.layout();
  });

  // ---- the parts ----

  // Speaker notes, if the deck has any: the switch and the column beside the stage.
  deck.notes = installNotes({
    root, slides, sectionsOf, members: shape.members, titleOf: shape.titleOf, el, button, icon,
  });
  installAgenda(deck);
  layoutSteps(root);
  installFooters(deck);
  installPresent(deck);
  deck.bar = installBar(deck);
  deck.help = installHelp(deck);
  deck.overview = installOverview(deck);
  deck.links = installLinks(deck);
  installPrinting(slides, {
    isPresenting: () => state.presenting,
    followLinks: deck.links.follow,
    pageAfter: (i) => (deck.notes.has ? deck.notes.printPage(i) : null),
    addressesOf: shape.addressesOf,
    levelOf: shape.levelOf,
  });
  installKeys(deck);
  installWheel(deck);
  document.body.tabIndex = -1;

  // ---- the address ----

  function followAddress() {
    const target = shape.parseHash(location.hash);
    if (!target) {
      deck.bar.clearError();
      return;
    }
    if (target.error) {
      deck.bar.showError(target.error);
      return;
    }
    // The address already names this slide, so it stays as it was written until a key moves on.
    enter(target.index, 0, false);
  }
  window.addEventListener('hashchange', followAddress);
  followAddress();

  deck.bar.watch();
}

init();
