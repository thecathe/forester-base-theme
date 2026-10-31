// SPDX-License-Identifier: CC0-1.0
//
// The toolbar, and the two strips that go with it. While presenting, the toolbar sits above the slide (below it, faint,
// over the slide's edge, when the window is full screen); the page itself comes back when presenting stops. It holds the
// buttons (stop, previous and next, the section buttons, the link, the ?, the overview, full screen, and the notes
// if the deck has any), the count, where you are, the go-to list (deck-goto.js) and the progress bar: a segment for each
// part of the talk, as wide as it has slides, filled as far as you have got. Pointing at a segment names it; clicking goes
// to its first slide.
//
// The strips: an error (a link that names a slide which is not there: showError, clearError) and a notice, in yellow,
// for a slide inside a section that holds content which is not a slide (data-deck-warn, written by deck.xsl: that content
// is never presented; the go-to list marks the section). The toolbar also owns how much room the stage has: the slide
// takes whatever the toolbar leaves (--bar-h), and in full screen, where there is no room to spare, the toolbar floats over
// the slide's lower edge and the footer is raised by the part of the stage it covers (--footer-lift). A slide with more
// on it than fits is flagged "cut off" (checkOverflow).
//
// It follows the slide on show (deck:show) and presenting (deck:present). deck.js calls layout() and clearError() when it
// enters, showError() for a bad address, hideNotice() is for the overview; and watch(), last of all, makes it look again
// when the window, the fonts, the notes or the slide's own markup change.
//
// Install it after what else changes how a slide looks when it is shown (the agenda): the check of what fits is made when
// this hears 'deck:show', and a listener installed earlier has run by then.

import { installGoto } from './deck-goto.js';
import { stepsOf } from './deck-steps.js';

export function installBar(deck) {
  const { root, slides, last, state, notes } = deck;
  const { sectionsOf, members, sectionStarts, segments, titleOf, innermost, relative, trailOf, linksTo, describe, warningOf } = deck.shape;
  const { el, button, icon } = deck.ui;

  const stopButton = button('deck-stop', '■ Stop presenting', 'Stop presenting and go back to the page (Esc)', () => deck.exit());
  const prevButton = button('deck-prev', '‹', 'Previous (←)', () => deck.prev());
  const nextButton = button('deck-next', '›', 'Next (→, space)', () => deck.next());
  const prevSectionButton = button('deck-prev-section', '«', 'Start of the section, or of the one before ([)', () => deck.prevSection());
  const nextSectionButton = button('deck-next-section', '»', 'Start of the next section (])', () => deck.nextSection());
  const count = el('span', 'deck-count');
  const trail = el('span', 'deck-trail');
  const goto = installGoto(deck);
  // The link and the word "copied" share one cell of a grid, so showing either leaves the width alone.
  const whereName = el('span', 'deck-where-name');
  const whereDone = el('span', 'deck-where-done', 'copied');
  const whereText = el('span', 'deck-where-text');
  whereText.append(whereName, whereDone);
  const whereIcon = el('span', 'deck-where-icon');
  whereIcon.append(icon('copy'));
  const where = button('deck-where', '', '', () => copyLink());
  where.append(whereText, whereIcon);
  const warn = el('span', 'deck-warn', '⚠ cut off');
  warn.hidden = true;
  const fullButton = button('deck-full', '⛶', 'Full screen (f)', () => deck.toggleFullscreen());
  const helpButton = button('deck-help-button', '?', 'Keyboard shortcuts (?)', () => deck.help.toggle());
  helpButton.setAttribute('aria-label', 'Keyboard shortcuts');
  const overviewButton = button('deck-overview', '', 'Overview of every slide (o)', () => deck.overview.toggle());
  overviewButton.append(icon('grid'));
  overviewButton.setAttribute('aria-label', 'Overview of every slide');

  const bar = el('div', 'deck-bar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Presentation controls');
  const nav = el('span', 'deck-group');
  nav.append(prevSectionButton, prevButton, count, nextButton, nextSectionButton);
  const tools = el('span', 'deck-group deck-tools');
  tools.append(warn, where, ...(notes.has ? [notes.barButton] : []), helpButton, overviewButton, fullButton);
  // The progress bar: a segment for each part of the talk, as wide as it has slides, filled as far as
  // you have got. Pointing at one names it; clicking goes to its first slide.
  const progress = el('div', 'deck-progress');
  progress.setAttribute('aria-hidden', 'true');
  const segmentBoxes = segments.map((seg) => {
    const box = el('div', 'deck-seg');
    box.style.flex = `${seg.count} 1 0`;
    box.title = seg.loose && seg.count > 1
      ? `${seg.title} and ${seg.count - 1} more (${seg.count} slides)`
      : `${seg.title} (${seg.count} slide${seg.count === 1 ? '' : 's'})`;
    const fill = el('div', 'deck-seg-fill');
    box.append(fill);
    box.addEventListener('click', () => deck.show(seg.start));
    progress.append(box);
    return { box, fill, seg };
  });
  bar.append(stopButton, nav, trail, goto.element, tools, progress);

  const errorBar = el('div', 'deck-error');
  errorBar.setAttribute('role', 'alert');
  errorBar.hidden = true;
  const noticeBar = el('div', 'deck-notice');
  noticeBar.setAttribute('role', 'status');
  noticeBar.hidden = true;
  document.body.append(bar, errorBar, noticeBar);

  const showError = (message) => { errorBar.textContent = message; errorBar.hidden = false; };
  const clearError = () => { errorBar.hidden = true; };
  const hideNotice = () => { noticeBar.hidden = true; };

  // The sections around the slide on show that hold content which is not being presented.
  function showNotice(index) {
    const said = sectionsOf[index].filter((s) => warningOf(s)).map((s) => `⚠ ${titleOf(s)}: ${warningOf(s)}`);
    slides[index].classList.toggle('deck-warned', said.length > 0);
    noticeBar.textContent = said.join('   ');
    noticeBar.hidden = said.length === 0;
  }

  let whereLabel = '';

  function update() {
    const { current, step } = state;
    const s = innermost(current);
    const steps = stepsOf(slides[current]).count;
    count.textContent = `${current + 1} / ${slides.length}` + (steps > 0 ? ` · step ${step}/${steps}` : '');
    trail.textContent = `${trailOf(current)} (${relative(s, current)} of ${members.get(s).length})`;
    trail.title = describe(current, step);
    prevButton.disabled = current === 0 && step === 0;
    nextButton.disabled = current === last && step === steps;
    for (const { box, fill, seg } of segmentBoxes) {
      const done = Math.min(1, Math.max(0, (current + 1 - seg.start) / seg.count));
      fill.style.width = `${done * 100}%`;
      box.classList.toggle('deck-seg-here', current >= seg.start && current < seg.start + seg.count);
    }
    prevSectionButton.disabled = current === 0 && step === 0;
    nextSectionButton.disabled = !sectionStarts.some((i) => i > current);
    const links = linksTo(current);
    whereLabel = links[0];
    whereName.textContent = whereLabel;
    where.title = `Copy a link to this slide. Links that reach it: ${links.map((l) => '#' + l).join('   ')}`;
  }

  async function copyLink() {
    const url = `${location.href.split('#')[0]}#${whereLabel}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('A link to this slide:', url);
      return;
    }
    where.classList.add('copied');
    whereIcon.replaceChildren(icon('check'));
    setTimeout(() => {
      where.classList.remove('copied');
      whereIcon.replaceChildren(icon('copy'));
    }, 1200);
  }

  function checkOverflow() {
    if (!state.presenting || state.current < 0 || state.overview) return;
    const s = slides[state.current];
    const over = s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2;
    warn.hidden = !over;
    if (over) warn.title = 'This slide has more on it than fits, so part of it is cut off.';
  }

  // The slide takes whatever the toolbar leaves; full screen has no room to spare, so the toolbar
  // floats over the slide's lower edge there instead.
  function layout() {
    const room = state.presenting && !document.fullscreenElement ? bar.offsetHeight : 0;
    document.body.style.setProperty('--bar-h', `${room}px`);
    liftFooters();
    checkOverflow();
  }

  // In full screen the toolbar is a strip over the slide's lower edge, where the footer is. The footer
  // is raised by the part of the stage the strip covers (in the slide's own em, which deck.css reads).
  function liftFooters() {
    let lift = 0;
    if (state.presenting && document.fullscreenElement) {
      const w = Math.min(innerWidth - (notes.has ? notes.stageWidth() : 0), (innerHeight * 16) / 9);
      const stageBottom = (innerHeight + (w * 9) / 16) / 2;
      lift = Math.max(0, stageBottom - (innerHeight - bar.offsetHeight)) / (w * 0.022);
    }
    document.body.style.setProperty('--footer-lift', String(lift));
  }
  new ResizeObserver(layout).observe(bar);

  document.addEventListener('deck:show', (e) => {
    update();
    showNotice(e.detail.index);
    checkOverflow();
  });
  document.addEventListener('deck:present', (e) => {
    if (e.detail.on) return;
    hideNotice();
    document.body.style.removeProperty('--bar-h');
  });

  // Look again when something that changes what fits changes: the notes take room from the stage (or give it back), the
  // window is resized, the maths and fonts arrive, the slide's markup changes. Called last of all by deck.js, when the page is built.
  function watch() {
    document.addEventListener('deck:notes', () => { liftFooters(); checkOverflow(); });
    window.addEventListener('resize', () => { liftFooters(); checkOverflow(); });
    window.addEventListener('load', checkOverflow);
    document.fonts?.ready.then(checkOverflow);
    let pending = 0;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(checkOverflow, 100);
    }).observe(root, { childList: true, subtree: true });
  }

  return { layout, showError, clearError, hideNotice, watch };
}
