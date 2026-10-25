// SPDX-License-Identifier: CC0-1.0
//
// Deck mode: presents a deck page. Loaded on deck pages only (see deck.xsl), as a plain script of
// its own and not part of the bundled forester.js, so it needs no build step.
//
// It works out nothing about the deck's shape. deck.xsl wrote that into the page when it was built
// (data-deck="deck|section|slide" on each unit, data-slug on the deck and its sections) and this
// reads it. What it adds is the state: which slide is on show and how far through its steps.
//
// Links, from the page's address: #slide-3 (the third slide of the whole deck), #name (the first
// slide of the section called name) and #name/2 (the second slide of that section). A link that
// names a slide which is not there is shown as an error.
//
// Steps: an element with data-step-from="a" (and, if it goes away again, data-step-until="b") is
// shown from step a up to, but not including, step b. "Next" takes the next step of the slide on
// show and, when there are none left, the next slide.

const KEYS_NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', 'Enter']);
const KEYS_PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

function init() {
  const root = document.querySelector('article > section[data-deck="deck"]');
  if (!root) return;
  const slides = [...root.querySelectorAll('section[data-deck="slide"]')];
  if (slides.length === 0) return;
  const last = slides.length - 1;

  // The deck and its sections that contain each slide, outermost first, and the slides each
  // section contains (as indexes), in order. The deck itself counts as the outermost section.
  const sectionsOf = slides.map((slide) => {
    const chain = [];
    for (let e = slide.parentElement.closest('section[data-deck]'); e; e = e.parentElement.closest('section[data-deck]')) {
      chain.unshift(e);
    }
    return chain;
  });
  const members = new Map();
  [root, ...root.querySelectorAll('section[data-deck="section"]')].forEach((s) => members.set(s, []));
  sectionsOf.forEach((chain, i) => chain.forEach((s) => members.get(s).push(i)));
  const bySlug = new Map();
  for (const s of members.keys()) {
    if (s.dataset.slug && !bySlug.has(s.dataset.slug)) bySlug.set(s.dataset.slug, s);
  }

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

  // Steps of a slide, worked out once.
  const stepCache = new WeakMap();
  function stepsOf(slide) {
    let s = stepCache.get(slide);
    if (!s) {
      const list = [...slide.querySelectorAll('[data-step-from]')].map((el) => ({
        el,
        from: Number(el.dataset.stepFrom) || 0,
        until: el.dataset.stepUntil === undefined ? null : Number(el.dataset.stepUntil),
      }));
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

  const where = el('span', 'deck-where');
  const warn = el('span', 'deck-warn', '⚠ cut off');
  warn.hidden = true;
  const count = el('span', 'deck-count');
  const prevButton = button('deck-prev', '‹', 'Previous (←)', () => prev());
  const nextButton = button('deck-next', '›', 'Next (→, space)', () => next());
  const controls = el('span', 'deck-controls');
  controls.append(
    warn, prevButton, count, nextButton,
    button('deck-full', '⛶', 'Full screen (f)', () => toggleFullscreen()),
    button('deck-exit', '✕', 'Stop presenting (Esc)', () => exit()),
  );
  const hud = el('div', 'deck-hud');
  hud.setAttribute('role', 'toolbar');
  hud.setAttribute('aria-label', 'Presentation controls');
  hud.append(where, controls);
  const errorBar = el('div', 'deck-error');
  errorBar.setAttribute('role', 'alert');
  errorBar.hidden = true;
  document.body.append(hud, errorBar);

  const showError = (message) => { errorBar.textContent = message; errorBar.hidden = false; };
  const clearError = () => { errorBar.hidden = true; };

  // ---- state ----

  let current = -1;
  let step = 0;
  let presenting = false;
  let goFullscreenOnKey = false;

  function applyStep() {
    for (const f of stepsOf(slides[current]).list) {
      const shown = step >= f.from && (f.until === null || step < f.until);
      f.el.classList.toggle('deck-hidden', !shown);
    }
  }

  function updateHud() {
    const chain = sectionsOf[current];
    const steps = stepsOf(slides[current]).count;
    count.textContent = `${current + 1} / ${slides.length}` + (steps > 0 ? ` · ${step}/${steps}` : '');
    const inner = chain[chain.length - 1];
    const links = [`#slide-${current + 1}`];
    for (const s of chain) {
      if (s.dataset.slug) links.push(`#${s.dataset.slug}/${members.get(s).indexOf(current) + 1}`);
    }
    where.textContent = inner.dataset.slug ? links[links.length - 1].slice(1) : `slide ${current + 1}`;
    where.title = `Links to this slide: ${links.join('   ')}`;
    prevButton.disabled = current === 0 && step === 0;
    nextButton.disabled = current === last && step === steps;
  }

  function checkOverflow() {
    if (!presenting || current < 0) return;
    const s = slides[current];
    const over = s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2;
    warn.hidden = !over;
    if (over) warn.title = "This slide has more on it than fits, so part of it is cut off.";
  }

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
    updateHud();
    checkOverflow();
    if (writeAddress) history.replaceState(null, '', `#slide-${index + 1}`);
  }

  function enter(index, newStep = 0, writeAddress = true) {
    if (!presenting) {
      presenting = true;
      document.body.classList.add('presenting');
    }
    clearError();
    show(index, newStep, writeAddress);
  }

  function exit() {
    if (!presenting) return;
    presenting = false;
    goFullscreenOnKey = false;
    document.body.classList.remove('presenting');
    const slide = slides[current];
    clearShown();
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

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // ---- the Present button, in the deck's metadata line ----

  const present = button('deck-present', '▶ Present', `Present this deck (${slides.length} slides). Links such as #slide-3 open it on that slide.`, () => {
    enter(current >= 0 ? current : 0);
    toggleFullscreen();
  });
  const metadata = root.querySelector(':scope > details > summary > header .metadata ul');
  if (metadata) {
    const li = el('li', 'meta-item');
    li.append(present);
    metadata.append(li);
  } else {
    root.querySelector(':scope > details > summary > header')?.append(present);
  }

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
    // Opened from a link, the stage fills the window; the first key may take the whole screen.
    if (goFullscreenOnKey && e.key !== 'Escape') {
      goFullscreenOnKey = false;
      if (!document.fullscreenElement && e.key !== 'f' && e.key !== 'F') toggleFullscreen();
    }
  });

  function followAddress(onLoad) {
    const target = parseHash(location.hash);
    if (!target) {
      clearError();
      return;
    }
    if (target.error) {
      showError(target.error);
      return;
    }
    if (!presenting && onLoad) goFullscreenOnKey = true;
    // The address already names this slide, so it stays as it was written until a key moves on.
    enter(target.index, 0, false);
  }
  window.addEventListener('hashchange', () => followAddress(false));
  followAddress(true);

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
