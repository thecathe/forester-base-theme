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
// shown from step a up to, but not including, step b. \fragment, \incremental, \qa, \pairs and \steps
// (trees/meta/fragments.tree) write elements that are numbered automatically. "Next" takes the next
// step of the slide on show and, when there are none left, the next slide.
//
// A deck or section that holds content which is not a slide has data-deck-warn (written by deck.xsl:
// that content is never presented). While presenting, a slide inside such a section says so in a
// yellow banner and an outline, and the go-to list marks the section.
//
// \footer{left}{centre}{right} (trees/meta/footer.tree) writes a hidden definition into a deck or a
// section; each slide takes the nearest one at or above its section and gets a footer drawn from it, with
// \var-section, \var-slide and the rest filled in for that slide. On the stage, in print and in the
// overview; not on the ordinary page. Title and bare slides have none unless they say \meta{footer}{show},
// and any slide can say \meta{footer}{none}.
//
// \agenda (trees/meta/navigation.tree) writes an empty block that is filled here, from the same marks,
// with an outline of the deck; while presenting, what is behind you is dimmed and where you are is bold.
//
// The ? button (or the key) lays the key bindings over the slide: they go away on Esc, which that press
// consumes, on a click anywhere (full screen takes the first Esc itself), or 3 seconds after the next key,
// which does its usual work. KEY_TABLE below is the one list of
// them; the overlay and a \keys block (trees/meta/navigation.tree) both draw from it.
//
// The overview (key o, or the grid button) shows every slide at once, small, with every step shown;
// arrows move between them, enter or a click goes to one, escape or o comes back to where you were.
// It reuses the stage's own look: every slide is given the class of the one on show, and the
// stylesheet scales them down.
//
// Scrolling the wheel or trackpad does the same as the arrow keys, once for each flick.
//
// While presenting, a toolbar sits above the slide (below it, faint, over the slide's edge, when the
// window is full screen); the page itself comes back when presenting stops.

// The key bindings, as shown by the ? overlay and \keys: groups of [keys, what they do].
const KEY_TABLE = [
  ['Slides and steps', [
    [['→', '↓', 'Space', 'Enter', 'PgDn'], 'Next step, or the next slide when there are none left'],
    [['←', '↑', 'PgUp', 'Shift+Space'], 'Back a step, or to the slide before, shown complete'],
    [['l'], 'Next slide, from its first step'],
    [['h'], 'Previous slide, from its first step'],
    [['j'], 'Next step of this slide, and no further'],
    [['k'], 'Previous step of this slide'],
    [['Home', 'End'], 'First slide; last slide, complete'],
  ]],
  ['Sections', [
    [[']', 'i'], 'Start of the next section'],
    [['[', 'u'], 'Start of this section, or of the one before'],
  ]],
  ['Views', [
    [['o'], 'Overview of every slide (there, arrows or h j k l move, Enter goes to one)'],
    [['f'], 'Full screen'],
    [['?'], 'This list'],
    [['Esc'], 'Closes this list or the overview; then leaves full screen; then stops presenting'],
  ]],
  ['Pointer', [
    [['Wheel', 'Trackpad'], 'Back and forward, once for each flick'],
    [['Click'], 'A progress bar segment goes there; in the overview a slide goes there; on this list, closes it'],
  ]],
];
const HELP_MS = 3000;

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
  // Where each section begins, as slide indexes, with the start of the talk first: what the section keys
  // move between. A section nested in another counts, as it does in the go-to list.
  const sectionStarts = [...new Set([0, ...sectionList.slice(1).map((s) => members.get(s)[0]).filter((i) => i !== undefined)])]
    .sort((a, b) => a - b);
  // A bare piece of text directly in a deck or section (deck.xsl warns about it: it is never presented)
  // is a text node, which no stylesheet can hide and which the overview's grid would give a cell of its
  // own. In an element it is neither; the rules that hide what is not a unit then hide it.
  for (const unit of sectionList) {
    for (const d of unit.querySelectorAll(':scope > details')) {
      for (const node of [...d.childNodes]) {
        if (node.nodeType !== Node.TEXT_NODE || node.textContent.trim() === '') continue;
        const wrap = document.createElement('span');
        wrap.className = 'deck-stray';
        node.replaceWith(wrap);
        wrap.append(node);
      }
    }
  }

  // The segments of the progress bar: each section directly in the deck, and each run of slides that
  // sit directly in it (a title slide, a loose slide between sections).
  const segments = [];
  for (const unit of root.querySelectorAll(':scope > details > section[data-deck]')) {
    if (unit.dataset.deck === 'section') {
      const inside = members.get(unit);
      if (inside.length > 0) segments.push({ title: titleOf(unit), start: inside[0], count: inside.length });
    } else {
      const i = slides.indexOf(unit);
      const run = segments[segments.length - 1];
      if (run && run.loose && run.start + run.count === i) run.count++;
      else segments.push({ title: titleOf(unit), start: i, count: 1, loose: true });
    }
  }
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
  // whichever step came before, with two exceptions:
  //  - a fragment that is the first thing inside another fragment arrives with it, so that an item of
  //    a list never shows up empty before the step it holds (see hasContentBefore);
  //  - the picture of a \step (in \steps, or among the \pair of a \pairs) goes away when the next row
  //    arrives, whether that is a \pair or a \step, so a step's picture is only ever there until then.
  const FRAGMENTS = '[data-step-from], .fragment, .incremental > :is(ul, ol) > li';
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

  function stepsOf(slide) {
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
      for (const f of list) {
        if (!f.el.matches('.step-visual')) continue;
        const row = f.el.parentElement.nextElementSibling;
        const next = row && (row.matches('.fragment') ? row : row.querySelector('.fragment'));
        if (next && byEl.has(next)) f.until = byEl.get(next).from;
      }
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
  // KEY_TABLE as elements: a group is a title and rows of keys and what they do.
  function keysTable() {
    const table = el('div', 'keys-table');
    for (const [title, rows] of KEY_TABLE) {
      const group = el('div', 'keys-group');
      group.append(el('div', 'keys-title', title));
      for (const [keys, what] of rows) {
        const row = el('div', 'keys-row');
        const cap = el('span', 'keys-caps');
        keys.forEach((k) => cap.append(el('kbd', '', k)));
        row.append(cap, el('span', 'keys-what', what));
        group.append(row);
      }
      table.append(group);
    }
    return table;
  }

  // Small line icons, drawn to follow the text colour.
  const ICONS = {
    copy: '<rect x="6" y="6" width="7.5" height="7.5" rx="1.5"/><path d="M3.5 10V4A1.5 1.5 0 0 1 5 2.5h5.5"/>',
    check: '<path d="M3 8.5l3.2 3.2L13 4.8"/>',
    hook: '<path d="M2.5 4h6a3.5 3.5 0 0 1 3.5 3.5V13"/><path d="M9.8 10.5L12 13l2.2-2.5"/>',
    grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
  };
  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', 'deck-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name];
    return svg;
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
  const prevSectionButton = button('deck-prev-section', '«', 'Start of the section, or of the one before ([)', () => prevSection());
  const nextSectionButton = button('deck-next-section', '»', 'Start of the next section (])', () => nextSection());
  const count = el('span', 'deck-count');
  const trail = el('span', 'deck-trail');
  const gotoLabel = el('span', 'deck-label', 'Go to');
  const gotoSelect = el('select', 'deck-goto');
  gotoSelect.setAttribute('aria-label', 'Go to');
  const modeSections = button('deck-mode', 'Sections', 'List the sections', () => setGotoMode('sections'));
  const modeSlides = button('deck-mode', 'Slides', 'List every slide', () => setGotoMode('slides'));
  const modes = el('span', 'deck-modes');
  modes.append(modeSections, modeSlides);
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
  const fullButton = button('deck-full', '⛶', 'Full screen (f)', () => toggleFullscreen());
  const helpButton = button('deck-help-button', '?', 'Keyboard shortcuts (?)', () => (helpOpen() ? hideHelp() : showHelp()));
  helpButton.setAttribute('aria-label', 'Keyboard shortcuts');
  const overviewButton = button('deck-overview', '', 'Overview of every slide (o)', () => (overview ? leaveOverview(true) : openOverview()));
  overviewButton.append(icon('grid'));
  overviewButton.setAttribute('aria-label', 'Overview of every slide');

  const bar = el('div', 'deck-bar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Presentation controls');
  const nav = el('span', 'deck-group');
  nav.append(prevSectionButton, prevButton, count, nextButton, nextSectionButton);
  const jump = el('span', 'deck-group deck-jump');
  jump.append(gotoLabel, gotoSelect, modes);
  const tools = el('span', 'deck-group deck-tools');
  tools.append(warn, where, helpButton, overviewButton, fullButton);
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
    box.addEventListener('click', () => show(seg.start));
    progress.append(box);
    return { box, fill, seg };
  });
  bar.append(stopButton, nav, trail, jump, tools, progress);

  const errorBar = el('div', 'deck-error');
  errorBar.setAttribute('role', 'alert');
  errorBar.hidden = true;
  const noticeBar = el('div', 'deck-notice');
  noticeBar.setAttribute('role', 'status');
  noticeBar.hidden = true;
  const helpBox = el('div', 'deck-help');
  helpBox.setAttribute('role', 'dialog');
  helpBox.setAttribute('aria-label', 'Keyboard shortcuts');
  helpBox.hidden = true;
  const helpPanel = el('div', 'deck-help-panel');
  helpPanel.append(
    el('div', 'deck-help-title', 'Keyboard shortcuts'),
    keysTable(),
    el('div', 'deck-help-note', `Esc closes this; so does a click anywhere, or ${HELP_MS / 1000} seconds after the next key.`),
  );
  helpBox.append(helpPanel);
  helpBox.addEventListener('click', () => hideHelp());
  document.body.append(bar, errorBar, noticeBar, helpBox);
  document.body.tabIndex = -1;

  const showError = (message) => { errorBar.textContent = message; errorBar.hidden = false; };
  const clearError = () => { errorBar.hidden = true; };
  // What the build said about a section (see data-deck-warn above); '' when there is nothing.
  const warningOf = (s) => s.dataset.deckWarn || '';
  const marked = (s) => (warningOf(s) ? '⚠ ' : '');

  // ---- state ----

  let current = -1;
  let step = 0;
  let presenting = false;
  let overview = false;
  let selected = 0;
  const agendaItems = [];
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
        option(String(k), `${indent(depthOf(s))}${marked(s)}${titleOf(s)} (${n})`, n === 0);
      });
    } else {
      let shownIn = null;
      slides.forEach((slide, i) => {
        const s = innermost(i);
        if (s !== shownIn) {
          shownIn = s;
          option('', `${indent(depthOf(s))}— ${marked(s)}${titleOf(s)} —`, true);
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
    where.classList.add('copied');
    whereIcon.replaceChildren(icon('check'));
    setTimeout(() => {
      where.classList.remove('copied');
      whereIcon.replaceChildren(icon('copy'));
    }, 1200);
  }

  function checkOverflow() {
    if (!presenting || current < 0 || overview) return;
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
    liftFooters();
    checkOverflow();
  }

  // In full screen the toolbar is a strip over the slide's lower edge, where the footer is. The footer
  // is raised by the part of the stage the strip covers (in the slide's own em, which deck.css reads).
  function liftFooters() {
    let lift = 0;
    if (presenting && document.fullscreenElement) {
      const w = Math.min(innerWidth, (innerHeight * 16) / 9);
      const stageBottom = (innerHeight + (w * 9) / 16) / 2;
      lift = Math.max(0, stageBottom - (innerHeight - bar.offsetHeight)) / (w * 0.022);
    }
    document.body.style.setProperty('--footer-lift', String(lift));
  }
  new ResizeObserver(layoutBar).observe(bar);

  function clearShown() {
    if (current < 0) return;
    slides[current].classList.remove('current', 'deck-warned');
    sectionsOf[current].forEach((s) => s.classList.remove('in-chain'));
    noticeBar.hidden = true;
  }

  // The sections around the slide on show that hold content which is not being presented.
  function showNotice(index) {
    const said = sectionsOf[index].filter((s) => warningOf(s)).map((s) => `⚠ ${titleOf(s)}: ${warningOf(s)}`);
    slides[index].classList.toggle('deck-warned', said.length > 0);
    noticeBar.textContent = said.join('   ');
    noticeBar.hidden = said.length === 0;
  }

  function show(index, newStep = 0, writeAddress = true) {
    leaveOverview();
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
    showNotice(index);
    markAgendas();
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

  // ---- the ? help ----

  let helpTimer = 0;
  const helpOpen = () => !helpBox.hidden;
  function showHelp() {
    clearTimeout(helpTimer);
    helpTimer = 0;
    helpBox.hidden = false;
  }
  function hideHelp() {
    clearTimeout(helpTimer);
    helpTimer = 0;
    helpBox.hidden = true;
  }

  // ---- the overview ----

  // Every slide takes the class of the one on show, and every section the class of those around it,
  // so the stage's own rules lay each one out; deck.css scales them into a grid.
  function openOverview() {
    if (!presenting || overview) return;
    overview = true;
    selected = current;
    document.body.classList.add('overview');
    noticeBar.hidden = true;
    for (const s of sectionList) {
      s.classList.add('in-chain');
      const d = s.querySelector(':scope > details');
      if (d) d.open = true;
    }
    slides.forEach((slide, i) => {
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
  function leaveOverview(stay = false) {
    if (!overview) return;
    overview = false;
    document.body.classList.remove('overview');
    for (const slide of slides) {
      slide.classList.remove('current', 'deck-warned', 'overview-selected');
      slide.removeAttribute('data-n');
      slide.removeAttribute('title');
    }
    for (const s of sectionList) s.classList.remove('in-chain');
    if (stay) show(current, step);
  }

  // ---- \agenda: an outline of the deck, with how far through you are ----

  const unitsOf = (section) => [...section.querySelectorAll(':scope > details > section[data-deck]')];
  // The first and last slide a unit covers, as indexes; null for a section with no slides.
  function rangeOf(unit) {
    if (unit.dataset.deck === 'slide') {
      const i = slides.indexOf(unit);
      return [i, i];
    }
    const inside = members.get(unit);
    return inside.length > 0 ? [inside[0], inside[inside.length - 1]] : null;
  }

  // A list of the units of a section: sections with their own list inside when `deep`, and slides
  // when `withSlides`. `skip` is a unit to leave out (the slide the outline is on). A part's own
  // divider is left out too (a slide titled like its section, laid out as a divider): the entry
  // for the section already goes to it.
  function outline(section, { withSlides, deep, skip }) {
    const list = el('ul', 'agenda-list');
    for (const unit of unitsOf(section)) {
      const isSection = unit.dataset.deck === 'section';
      const partDivider = !isSection && unit.dataset.layout === 'divider' && unit.dataset.title === section.dataset.title;
      const range = unit === skip || partDivider || (!isSection && !withSlides) ? null : rangeOf(unit);
      if (!range) continue;
      const item = el('li', isSection ? 'agenda-section' : 'agenda-slide');
      item.dataset.from = String(range[0]);
      item.dataset.to = String(range[1]);
      const link = el('a', '', titleOf(unit));
      link.href = `#slide-${range[0] + 1}`;
      item.append(link);
      if (isSection && deep) {
        const inner = outline(unit, { withSlides, deep, skip });
        if (inner.children.length > 0) item.append(inner);
      }
      list.append(item);
      agendaItems.push(item);
    }
    return list;
  }

  function buildAgenda(block) {
    const host = block.closest('section[data-deck="slide"]');
    let list;
    if (block.classList.contains('agenda-here')) {
      const section = host && enclosing(host);
      if (section) list = outline(section, { withSlides: true, deep: false, skip: host });
    } else if (block.classList.contains('agenda-all')) {
      list = outline(root, { withSlides: true, deep: true });
      // A whole talk is long: as many columns as it takes at about twelve entries to a column, and a
      // smaller type for a very long one, so that it fits a slide.
      const n = list.querySelectorAll('li').length;
      block.style.setProperty('--agenda-cols', String(Math.min(5, Math.max(1, Math.ceil(n / 12)))));
      block.style.setProperty('--agenda-size', n > 36 ? '.62em' : n > 24 ? '.72em' : '.86em');
    } else {
      list = outline(root, { withSlides: false, deep: true });
    }
    if (list && list.children.length > 0) block.replaceChildren(list);
  }

  // ---- footers ----

  // What a \var-... block stands for on slide i.
  function varText(name, i) {
    switch (name) {
      case 'section': return titleOf(innermost(i));
      case 'trail': return trailOf(i);
      case 'slide': return String(i + 1);
      case 'slides': return String(slides.length);
      case 'deck': return titleOf(root);
      default: return '';
    }
  }

  // The footer a slide has by default: none on a title or a bare slide, which have the stage to themselves.
  const wantsFooter = (slide) => {
    const say = slide.dataset.footer;
    return say === 'show' || (say !== 'none' && slide.dataset.layout !== 'title' && slide.dataset.layout !== 'bare');
  };

  function buildFooters() {
    slides.forEach((slide, i) => {
      const chain = sectionsOf[i];
      let def = null;
      for (let k = chain.length - 1; k >= 0 && !def; k--) def = chain[k].querySelector(':scope > details > .deck-footer-def');
      if (def && wantsFooter(slide)) {
        const footer = el('div', 'deck-footer');
        let any = false;
        for (const zone of [...def.children].slice(0, 3)) {
          const box = el('div', 'deck-footer-zone');
          for (const node of zone.childNodes) box.append(node.cloneNode(true));
          any = any || box.textContent.trim() !== '' || box.children.length > 0;
          footer.append(box);
        }
        // A definition with nothing in it is how a section says it wants no footer.
        if (any) {
          slide.append(footer);
          slide.classList.add('deck-has-footer');
        }
      }
      for (const v of slide.querySelectorAll('.deck-var')) v.textContent = varText(v.dataset.var, i);
    });
  }

  // Dim what is behind the slide on show and make bold the entry that holds it; nothing is marked off
  // the stage, where there is no "now".
  function markAgendas() {
    for (const item of agendaItems) {
      const from = Number(item.dataset.from);
      const to = Number(item.dataset.to);
      item.classList.toggle('agenda-done', presenting && current > to);
      item.classList.toggle('agenda-current', presenting && current >= from && current <= to);
    }
  }

  function select(i) {
    slides[selected].classList.remove('overview-selected');
    selected = i;
    slides[selected].classList.add('overview-selected');
    slides[selected].scrollIntoView({ block: 'nearest' });
  }

  // How many slides are in a row of the grid, for the up and down arrows.
  function overviewColumns() {
    const top = slides[0].getBoundingClientRect().top;
    return Math.max(1, slides.filter((s) => Math.abs(s.getBoundingClientRect().top - top) < 2).length);
  }

  function overviewKey(e) {
    let to = selected;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (key) {
      case 'ArrowRight':
      case 'l': to++; break;
      case 'ArrowLeft':
      case 'h': to--; break;
      case 'ArrowDown':
      case 'j': to += overviewColumns(); break;
      case 'ArrowUp':
      case 'k': to -= overviewColumns(); break;
      case 'Home': to = 0; break;
      case 'End': to = last; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        show(selected, selected === current ? step : 0);
        return;
      case 'Escape':
      case 'o':
        e.preventDefault();
        leaveOverview(true);
        return;
      case 'f':
        toggleFullscreen();
        break;
      default: return;
    }
    e.preventDefault();
    select(Math.min(last, Math.max(0, to)));
  }

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => {
      if (overview) show(i, i === current ? step : 0);
    });
  });

  function exit() {
    if (!presenting) return;
    leaveOverview();
    hideHelp();
    presenting = false;
    markAgendas();
    // Where to pick up again, unless that is just the start.
    resume = current > 0 || step > 0 ? { index: current, step } : null;
    updateResume();
    document.body.classList.remove('presenting');
    clearShown();
    document.body.style.removeProperty('--bar-h');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
  }

  function next() {
    if (step < stepsOf(slides[current]).count) show(current, step + 1);
    else if (current < last) show(current + 1, 0);
  }

  // The start of the next section, and the start of this one (or, from its first slide, of the one
  // before). Where a section begins is what the build marked; see sectionStarts.
  function nextSection() {
    const to = sectionStarts.find((i) => i > current);
    if (to !== undefined) show(to);
  }
  function prevSection() {
    const before = sectionStarts.filter((i) => i < current);
    if (before.length > 0) show(before[before.length - 1]);
    else if (current > 0 || step > 0) show(0);
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
  const showButton = button('deck-present deck-icon-button', '', 'Show where on the page you stopped', () => {
    if (!resume) return;
    const slide = slides[resume.index];
    slide.scrollIntoView({ block: 'start' });
    slide.classList.add('deck-flash');
    setTimeout(() => slide.classList.remove('deck-flash'), 1500);
  });
  showButton.append(icon('hook'));
  showButton.setAttribute('aria-label', 'Show where on the page you stopped');
  const resumeNote = el('span', 'deck-resume-note');
  const resumeItem = el('li', 'meta-item deck-resume');
  resumeItem.hidden = true;
  resumeItem.append(resumeButton, showButton, resumeNote);
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
  for (const block of root.querySelectorAll('.agenda')) buildAgenda(block);
  // \pairs and \steps lay their rows out by row number and by how many there are (deck.css), which only
  // the markup can tell.
  for (const block of root.querySelectorAll('.pairs, .steps')) {
    const rows = [...block.querySelectorAll(':scope > .pair, :scope > .step')];
    block.style.setProperty('--n', String(rows.length));
    rows.forEach((row, i) => row.style.setProperty('--r', String(i + 1)));
  }
  buildFooters();
  for (const block of root.querySelectorAll('.deck-keys')) block.replaceChildren(keysTable());
  fillGoto();

  // ---- printing ----

  // Printing the page gives a page for each slide with everything on it shown. A slide with something that
  // is only there for a while (the picture of a \step) or only when asked for (a \reveal, a \flip) would
  // lose it that way, so it prints as several pages, one for each state: for each step picture, the slide
  // as it is just after that picture arrives; and, if it has a reveal or a flip, a last page with them all
  // open, the others having them all closed. A slide with none of these prints as one page, as before.
  // The extra pages are copies of the slide, made for the printing and taken away after it.
  function printFrames(slide) {
    const { list, count } = stepsOf(slide);
    const presses = [...new Set(list.filter((f) => f.el.matches('.step-visual')).map((f) => f.from))].sort((a, b) => a - b);
    if (presses.length === 0 || presses[presses.length - 1] < count) presses.push(count);
    const frames = presses.map((press) => ({ press, open: false }));
    if (slide.querySelector('details.reveal, .flip-checkbox')) frames.push({ press: count, open: true });
    return frames;
  }

  // Sets a slide (or a copy of one, whose steps are in the same order) to a page's state.
  function showFrame(el, frame, list) {
    const els = el.querySelectorAll(FRAGMENTS);
    list.forEach((f, i) => {
      els[i].classList.toggle('deck-hidden', !(frame.press >= f.from && (f.until === null || frame.press < f.until)));
    });
    for (const d of el.querySelectorAll('details.reveal')) d.open = frame.open;
    for (const c of el.querySelectorAll('.flip-checkbox')) c.checked = frame.open;
    el.classList.add('deck-frame');
  }

  let afterPrint = [];
  window.addEventListener('beforeprint', () => {
    if (presenting) return; // the stage prints the slide on show, as it is
    for (const slide of slides) {
      const frames = printFrames(slide);
      if (frames.length < 2) continue;
      const { list } = stepsOf(slide);
      const saved = {
        hidden: list.map((f) => f.el.classList.contains('deck-hidden')),
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
        list.forEach((f, i) => f.el.classList.toggle('deck-hidden', saved.hidden[i]));
        slide.querySelectorAll('details.reveal').forEach((d, i) => { d.open = saved.open[i]; });
        slide.querySelectorAll('.flip-checkbox').forEach((c, i) => { c.checked = saved.checked[i]; });
      });
    }
  });
  window.addEventListener('afterprint', () => {
    for (const undo of afterPrint) undo();
    afterPrint = [];
  });

  // ---- keys, addresses, resizing ----

  document.addEventListener('keydown', (e) => {
    if (!presenting || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches('input, textarea, select, [contenteditable], ninja-keys'))) return;
    if (helpOpen()) {
      // Esc closes the list and is not passed on, so it does not also stop presenting. Any other key
      // does its usual work, and the first one that is not a bare modifier starts the countdown.
      if (e.key === 'Escape') {
        e.preventDefault();
        hideHelp();
        return;
      }
      if (!helpTimer && e.key !== '?' && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        helpTimer = setTimeout(hideHelp, HELP_MS);
      }
    }
    if (e.key === '?') {
      e.preventDefault();
      if (helpOpen()) hideHelp();
      else showHelp();
      return;
    }
    if (overview) {
      overviewKey(e);
      return;
    }
    // A focused link or button keeps the keys that activate it.
    const activates = e.target instanceof Element && e.target.closest('a, button, summary') !== null;
    let handled = true;
    if (KEYS_NEXT.has(e.key) || (e.key === ' ' && !e.shiftKey)) {
      if ((e.key === ' ' || e.key === 'Enter') && activates) return;
      next();
    } else if (KEYS_PREV.has(e.key) || (e.key === ' ' && e.shiftKey)) {
      if (e.key === ' ' && activates) return;
      prev();
    } else if (e.key === '[') prevSection();
    else if (e.key === ']') nextSection();
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(last, stepsOf(slides[last]).count);
    else if (e.key === 'Escape') exit();
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'o' || e.key === 'O') openOverview();
    // The same moves on the home row: h and l are the slide before and after (from its first step),
    // j and k the next and previous step of this slide and no further, u and i the sections.
    else if (e.key === 'l' || e.key === 'L') { if (current < last) show(current + 1); }
    else if (e.key === 'h' || e.key === 'H') { if (current > 0) show(current - 1); }
    else if (e.key === 'j' || e.key === 'J') { if (step < stepsOf(slides[current]).count) show(current, step + 1); }
    else if (e.key === 'k' || e.key === 'K') { if (step > 0) show(current, step - 1); }
    else if (e.key === 'i' || e.key === 'I') nextSection();
    else if (e.key === 'u' || e.key === 'U') prevSection();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
  });

  // Scrolling moves through the steps and slides, one move for each flick.
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
  const wheel = { last: -Infinity, lastDelta: 0, dir: 0, pushed: 0, spent: false, moved: -Infinity };
  document.addEventListener('wheel', (e) => {
    if (!presenting || overview || e.ctrlKey || e.metaKey) return; // ctrl and wheel is the browser's zoom; the overview scrolls
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
    if (wheel.pushed > 0) next();
    else prev();
  }, { passive: false });

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
  window.addEventListener('resize', () => { liftFooters(); checkOverflow(); });
  window.addEventListener('load', checkOverflow);
  document.fonts?.ready.then(checkOverflow);
  let pending = 0;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(checkOverflow, 100);
  }).observe(root, { childList: true, subtree: true });
}

init();
