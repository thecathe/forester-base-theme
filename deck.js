// SPDX-License-Identifier: CC0-1.0
//
// Deck mode: presents a deck page. Loaded on deck pages only (see deck.xsl), as a plain script of
// its own and not part of the bundled forester.js, so it needs no build step.
//
// It works out nothing about the deck's shape. deck.xsl wrote that into the page when it was built
// (data-deck="deck|section|slide" on each unit, data-slug and data-title) and this reads it. What it
// adds is the state: which slide is on show and how far through its steps.
//
// Links, from the page's address: #slide-3 (the third slide of the whole deck), #name (the first
// slide of the section called name) and #name/2 (the second slide of that section). A link that
// names a slide which is not there is shown as an error.
//
// Steps: an element with data-step-from="a" (and, if it goes away again, data-step-until="b") is
// shown from step a up to, but not including, step b. \fragment, \incremental, \qa and \steps
// (trees/meta/fragments.tree) write elements that are numbered automatically. "Next" takes the next
// step of the slide on show and, when there are none left, the next slide.
//
// While presenting, a toolbar sits above the slide (below it, faint, over the slide's edge, when the
// window is full screen); the page itself comes back when presenting stops.

const KEYS_NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', 'Enter']);
const KEYS_PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

function init() {
  const root = document.querySelector('article > section[data-deck="deck"]');
  if (!root) return;
  const slides = [...root.querySelectorAll('section[data-deck="slide"]')];
  if (slides.length === 0) return;
  const last = slides.length - 1;

  // ---- the deck's shape, read from the marks ----

  // The deck and its sections that contain each slide, outermost first, and the slides each
  // section contains (as indexes), in order. The deck itself counts as the outermost section.
  const enclosing = (e) => e.parentElement.closest('section[data-deck]');
  const sectionsOf = slides.map((slide) => {
    const chain = [];
    for (let e = enclosing(slide); e; e = enclosing(e)) chain.unshift(e);
    return chain;
  });
  const sectionList = [root, ...root.querySelectorAll('section[data-deck="section"]')];
  const members = new Map(sectionList.map((s) => [s, []]));
  sectionsOf.forEach((chain, i) => chain.forEach((s) => members.get(s).push(i)));
  const bySlug = new Map();
  for (const s of sectionList) {
    if (s.dataset.slug && !bySlug.has(s.dataset.slug)) bySlug.set(s.dataset.slug, s);
  }
  const depthOf = (s) => {
    let d = 0;
    for (let e = enclosing(s); e; e = enclosing(e)) d++;
    return d;
  };

  const titleOf = (e) => e.dataset.title || '(untitled)';
  const innermost = (i) => sectionsOf[i][sectionsOf[i].length - 1];
  const relative = (s, i) => members.get(s).indexOf(i) + 1;
  // "Coffee machine › Inner section", without the deck's own title unless it is all there is.
  const trailOf = (i) => {
    const chain = sectionsOf[i];
    return (chain.length > 1 ? chain.slice(1) : chain).map(titleOf).join(' › ');
  };
  // The ways of addressing a slide, the steadiest first.
  const linksTo = (i) => {
    const links = [];
    for (const s of [...sectionsOf[i]].reverse()) {
      if (s.dataset.slug) links.push(`${s.dataset.slug}/${relative(s, i)}`);
    }
    links.push(`slide-${i + 1}`);
    return links;
  };
  const describe = (i, step) => {
    const s = innermost(i);
    return `${trailOf(i)}, slide ${relative(s, i)} of ${members.get(s).length} (${i + 1} of ${slides.length} overall)` +
      (step > 0 ? `, step ${step}` : '');
  };

  // What an address means: {index} for a slide, {error} for a deck link that points nowhere, or
  // null when it is not a deck link at all (an ordinary anchor on the page).
  function parseHash(hash) {
    let h = hash.replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch { /* keep it as it is */ }
    let m = /^slide-(\d+)$/.exec(h);
    if (m) {
      const n = Number(m[1]);
      return n >= 1 && n <= slides.length
        ? { index: n - 1 }
        : { error: `There is no slide ${n}: this deck has ${slides.length} slide${slides.length === 1 ? '' : 's'}.` };
    }
    m = /^([^/]+)(?:\/(\d+))?$/.exec(h);
    const section = m && bySlug.get(m[1]);
    if (!section) return null;
    const inside = members.get(section);
    const n = m[2] === undefined ? 1 : Number(m[2]);
    if (inside.length === 0) return { error: `The section "${m[1]}" has no slides.` };
    if (n < 1 || n > inside.length) {
      return { error: `The section "${m[1]}" has ${inside.length} slide${inside.length === 1 ? '' : 's'}, so there is no slide ${n} in it.` };
    }
    return { index: inside[n - 1] };
  }

  // The steps of a slide, worked out once. A fragment (see trees/meta/fragments.tree) is anything
  // with data-step-from, a .fragment, or an item of a list inside an .incremental. The ones that
  // do not say which step they arrive on are numbered in the order they are written, after
  // whichever step came before.
  const FRAGMENTS = '[data-step-from], .fragment, .incremental > :is(ul, ol) > li';
  const stepCache = new WeakMap();
  function stepsOf(slide) {
    let s = stepCache.get(slide);
    if (!s) {
      let counter = 0;
      const list = [...slide.querySelectorAll(FRAGMENTS)].map((el) => {
        const from = el.dataset.stepFrom === undefined ? counter + 1 : Number(el.dataset.stepFrom) || 0;
        counter = Math.max(counter, from);
        return { el, from, until: el.dataset.stepUntil === undefined ? null : Number(el.dataset.stepUntil) };
      });
      s = { list, count: Math.max(0, ...list.map((f) => Math.max(f.from, f.until ?? 0))) };
      stepCache.set(slide, s);
    }
    return s;
  }

  // ---- the parts of the page this adds ----

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (className, text, title, onclick) => {
    const b = el('button', className, text);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', () => { b.blur(); onclick(); });
    return b;
  };

  const stopButton = button('deck-stop', '■ Stop presenting', 'Stop presenting and go back to the page (Esc)', () => exit());
  const prevButton = button('deck-prev', '‹', 'Previous (←)', () => prev());
  const nextButton = button('deck-next', '›', 'Next (→, space)', () => next());
  const count = el('span', 'deck-count');
  const trail = el('span', 'deck-trail');
  const gotoSelect = el('select', 'deck-goto');
  gotoSelect.setAttribute('aria-label', 'Go to');
  const modeSections = button('deck-mode', 'Sections', 'List the sections', () => setGotoMode('sections'));
  const modeSlides = button('deck-mode', 'Slides', 'List every slide', () => setGotoMode('slides'));
  const modes = el('span', 'deck-modes');
  modes.append(modeSections, modeSlides);
  const where = button('deck-where', '', '', () => copyLink());
  const warn = el('span', 'deck-warn', '⚠ cut off');
  warn.hidden = true;
  const fullButton = button('deck-full', '⛶', 'Full screen (f)', () => toggleFullscreen());

  const bar = el('div', 'deck-bar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Presentation controls');
  const nav = el('span', 'deck-group');
  nav.append(prevButton, count, nextButton);
  const jump = el('span', 'deck-group');
  jump.append(gotoSelect, modes);
  const tools = el('span', 'deck-group deck-tools');
  tools.append(warn, where, fullButton);
  bar.append(stopButton, nav, trail, jump, tools);

  const errorBar = el('div', 'deck-error');
  errorBar.setAttribute('role', 'alert');
  errorBar.hidden = true;
  document.body.append(bar, errorBar);
  document.body.tabIndex = -1;

  const showError = (message) => { errorBar.textContent = message; errorBar.hidden = false; };
  const clearError = () => { errorBar.hidden = true; };

  // ---- state ----

  let current = -1;
  let step = 0;
  let presenting = false;
  let resume = null;
  let gotoMode = 'sections';
  let whereLabel = '';

  function applyStep() {
    for (const f of stepsOf(slides[current]).list) {
      const shown = step >= f.from && (f.until === null || step < f.until);
      f.el.classList.toggle('deck-hidden', !shown);
    }
  }

  // The list of places to jump to: the sections, or every slide.
  function fillGoto() {
    gotoSelect.textContent = '';
    const option = (value, text, disabled) => {
      const o = el('option', '', text);
      o.value = value;
      o.disabled = disabled;
      gotoSelect.append(o);
    };
    const indent = (n) => '  '.repeat(n);
    if (gotoMode === 'sections') {
      sectionList.forEach((s, k) => {
        const n = members.get(s).length;
        option(String(k), `${indent(depthOf(s))}${titleOf(s)} (${n})`, n === 0);
      });
    } else {
      let shownIn = null;
      slides.forEach((slide, i) => {
        const s = innermost(i);
        if (s !== shownIn) {
          shownIn = s;
          option('', `${indent(depthOf(s))}— ${titleOf(s)} —`, true);
        }
        option(String(i), `${indent(depthOf(s) + 1)}${i + 1}. ${titleOf(slide)}`, false);
      });
    }
    modeSections.setAttribute('aria-pressed', String(gotoMode === 'sections'));
    modeSlides.setAttribute('aria-pressed', String(gotoMode === 'slides'));
    syncGoto();
  }
  function syncGoto() {
    if (current < 0) return;
    gotoSelect.value = gotoMode === 'sections' ? String(sectionList.indexOf(innermost(current))) : String(current);
  }
  function setGotoMode(mode) {
    gotoMode = mode;
    fillGoto();
  }
  gotoSelect.addEventListener('change', () => {
    const v = Number(gotoSelect.value);
    const index = gotoMode === 'sections' ? members.get(sectionList[v])[0] : v;
    gotoSelect.blur();
    if (index !== undefined) show(index);
  });

  function updateBar() {
    const s = innermost(current);
    const steps = stepsOf(slides[current]).count;
    count.textContent = `${current + 1} / ${slides.length}` + (steps > 0 ? ` · step ${step}/${steps}` : '');
    trail.textContent = `${trailOf(current)} (${relative(s, current)} of ${members.get(s).length})`;
    trail.title = describe(current, step);
    prevButton.disabled = current === 0 && step === 0;
    nextButton.disabled = current === last && step === steps;
    const links = linksTo(current);
    whereLabel = links[0];
    where.textContent = whereLabel;
    where.title = `Copy a link to this slide. Links that reach it: ${links.map((l) => '#' + l).join('   ')}`;
    syncGoto();
  }

  async function copyLink() {
    const url = `${location.href.split('#')[0]}#${whereLabel}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('A link to this slide:', url);
      return;
    }
    where.textContent = 'copied ✓';
    setTimeout(() => { where.textContent = whereLabel; }, 1200);
  }

  function checkOverflow() {
    if (!presenting || current < 0) return;
    const s = slides[current];
    const over = s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2;
    warn.hidden = !over;
    if (over) warn.title = 'This slide has more on it than fits, so part of it is cut off.';
  }

  // The slide takes whatever the toolbar leaves; full screen has no room to spare, so the toolbar
  // floats over the slide's lower edge there instead.
  function layoutBar() {
    const room = presenting && !document.fullscreenElement ? bar.offsetHeight : 0;
    document.body.style.setProperty('--bar-h', `${room}px`);
    checkOverflow();
  }
  new ResizeObserver(layoutBar).observe(bar);

  function clearShown() {
    if (current < 0) return;
    slides[current].classList.remove('current');
    sectionsOf[current].forEach((s) => s.classList.remove('in-chain'));
  }

  function show(index, newStep = 0, writeAddress = true) {
    clearShown();
    current = index;
    step = newStep;
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
    updateBar();
    checkOverflow();
    if (writeAddress) history.replaceState(null, '', `#slide-${index + 1}`);
  }

  function enter(index, newStep = 0, writeAddress = true) {
    if (!presenting) {
      presenting = true;
      resume = null;
      updateResume();
      document.body.classList.add('presenting');
      document.body.classList.toggle('deck-fullscreen', !!document.fullscreenElement);
    }
    clearError();
    layoutBar();
    show(index, newStep, writeAddress);
  }

  function exit() {
    if (!presenting) return;
    presenting = false;
    // Where to pick up again, unless that is just the start.
    resume = current > 0 || step > 0 ? { index: current, step } : null;
    updateResume();
    document.body.classList.remove('presenting');
    const slide = slides[current];
    clearShown();
    document.body.style.removeProperty('--bar-h');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    history.replaceState(null, '', location.pathname + location.search);
    slide.scrollIntoView({ block: 'start' });
  }

  function next() {
    if (step < stepsOf(slides[current]).count) show(current, step + 1);
    else if (current < last) show(current + 1, 0);
  }

  // Going back lands on the earlier slide with everything on it shown.
  function prev() {
    if (step > 0) show(current, step - 1);
    else if (current > 0) show(current - 1, stepsOf(slides[current - 1]).count);
  }

  const enterFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  };
  document.addEventListener('fullscreenchange', () => {
    const full = !!document.fullscreenElement;
    document.body.classList.toggle('deck-fullscreen', full);
    // Leaving full screen can leave the keyboard outside the page, which would swallow the next Esc.
    if (!full && presenting) {
      window.focus();
      document.body.focus({ preventScroll: true });
    }
    layoutBar();
  });

  // ---- the Present and Resume buttons, in the deck's metadata line ----

  const present = button('deck-present', '▶ Present', `Present this deck from the start (${slides.length} slides). Links such as #slide-3 open it on that slide.`, () => {
    enter(0);
    enterFullscreen();
  });
  const resumeButton = button('deck-present', '↩ Resume', 'Carry on from where you stopped', () => {
    if (!resume) return;
    enter(resume.index, resume.step);
    enterFullscreen();
  });
  const resumeNote = el('span', 'deck-resume-note');
  const resumeItem = el('li', 'meta-item deck-resume');
  resumeItem.hidden = true;
  resumeItem.append(resumeButton, resumeNote);
  const presentItem = el('li', 'meta-item');
  presentItem.append(present);

  function updateResume() {
    resumeItem.hidden = !resume;
    if (resume) resumeNote.textContent = describe(resume.index, resume.step);
  }

  const metadata = root.querySelector(':scope > details > summary > header .metadata ul');
  if (metadata) {
    metadata.append(presentItem, resumeItem);
  } else {
    root.querySelector(':scope > details > summary > header')?.append(present, resumeItem);
  }
  fillGoto();

  // ---- keys, addresses, resizing ----

  document.addEventListener('keydown', (e) => {
    if (!presenting || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches('input, textarea, select, [contenteditable], ninja-keys'))) return;
    // A focused link or button keeps the keys that activate it.
    const activates = e.target instanceof Element && e.target.closest('a, button, summary') !== null;
    let handled = true;
    if (KEYS_NEXT.has(e.key) || (e.key === ' ' && !e.shiftKey)) {
      if ((e.key === ' ' || e.key === 'Enter') && activates) return;
      next();
    } else if (KEYS_PREV.has(e.key) || (e.key === ' ' && e.shiftKey)) {
      if (e.key === ' ' && activates) return;
      prev();
    } else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(last, stepsOf(slides[last]).count);
    else if (e.key === 'Escape') exit();
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
  });

  function followAddress() {
    const target = parseHash(location.hash);
    if (!target) {
      clearError();
      return;
    }
    if (target.error) {
      showError(target.error);
      return;
    }
    // The address already names this slide, so it stays as it was written until a key moves on.
    enter(target.index, 0, false);
  }
  window.addEventListener('hashchange', followAddress);
  followAddress();

  // Recheck what fits when the size changes and when the maths and fonts have arrived.
  window.addEventListener('resize', checkOverflow);
  window.addEventListener('load', checkOverflow);
  document.fonts?.ready.then(checkOverflow);
  let pending = 0;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(checkOverflow, 100);
  }).observe(root, { childList: true, subtree: true });
}

init();
