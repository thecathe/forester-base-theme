// SPDX-License-Identifier: CC0-1.0
//
// The shape of a deck, read from the marks deck.xsl wrote into the page when it was built (data-deck="deck|section|slide"
// on each unit, data-slug and data-title): which slides there are, which sections hold each, what they are called, and
// what an address means. It works out nothing about the deck that the page does not say, and it changes nothing in the
// page (but for wrapStrayText, which is its own step). It has no idea which slide is on show: that is the state, which
// deck.js keeps.
//
// Links, from the page's address: #slide-3 (the third slide of the whole deck), #name (the first slide of the section
// called name) and #name/2 (the second slide of that section). A link that names a slide which is not there is an error.
//
// A deck or section that holds content which is not a slide has data-deck-warn (written by deck.xsl: that content is
// never presented); warningOf reads it.

// What readShape returns, where `i` is a slide's index and a "section" counts the deck itself as the outermost:
//   slides, last         the slides in order, and the index of the last
//   sectionsOf[i]        the deck and sections around slide i, outermost first
//   sectionList          the deck, then every section in the order of the page
//   members              Map: section -> the indexes of the slides it holds, in order
//   bySlug               Map: a section's name (data-slug, the first of that name) -> section
//   enclosing(e)         the section around a unit, or null
//   depthOf(section)     how deep it is (the deck is 0)
//   titleOf(unit)        its title, or "(untitled)"
//   innermost(i)         the section that holds slide i directly
//   relative(s, i)       slide i's number inside section s
//   trailOf(i)           "Coffee machine › Inner section": the sections around slide i, without the deck's own title
//   linksTo(i)           the addresses of slide i, the steadiest first
//   addressesOf(i)       every address parseHash reads for slide i, for the ids a PDF's links jump to (deck-print.js)
//   levelOf(i)           how deep slide i is in a PDF's outline (deck-print.js)
//   sectionStarts        where each section begins, as slide indexes, with the start of the talk first
//   segments             the progress bar's: each section directly in the deck, and each run of slides directly in it
//   describe(i, step)    a sentence naming slide i, for a title attribute
//   parseHash(hash)      {index} for a slide, {error} for a deck link that points nowhere, null for an ordinary anchor
//   warningOf(section)   what the build said about it (see above); '' when nothing
export function readShape(root) {
  const slides = [...root.querySelectorAll('section[data-deck="slide"]')];
  const last = slides.length - 1;

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
  // Every address parseHash reads for slide i, for the ids a PDF's links jump to (deck-print.js): the ways in linksTo, and a section's
  // own name for its first slide.
  const addressesOf = (i) => [
    ...linksTo(i),
    ...sectionList.filter((s) => s.dataset.slug && bySlug.get(s.dataset.slug) === s && members.get(s)[0] === i).map((s) => s.dataset.slug),
  ];
  // How deep slide i is in a PDF's outline (deck-print.js): a slide directly in the deck is at the top, the first slide of a section (usually
  // its divider) is the section's own entry, and the others are under it. A section has no heading in print to be an entry itself.
  const levelOf = (i) => {
    const depth = sectionsOf[i].length - 1;
    return Math.max(1, members.get(innermost(i))[0] === i ? depth : depth + 1);
  };
  // Where each section begins, as slide indexes, with the start of the talk first: what the section keys
  // move between. A section nested in another counts, as it does in the go-to list.
  const sectionStarts = [...new Set([0, ...sectionList.slice(1).map((s) => members.get(s)[0]).filter((i) => i !== undefined)])]
    .sort((a, b) => a - b);

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

  // What the build said about a section (see data-deck-warn above); '' when there is nothing.
  const warningOf = (s) => s.dataset.deckWarn || '';

  return {
    slides, last, sectionsOf, sectionList, members, bySlug, enclosing, depthOf, titleOf, innermost, relative, trailOf,
    linksTo, addressesOf, levelOf, sectionStarts, segments, describe, parseHash, warningOf,
  };
}

// A bare piece of text directly in a deck or section (deck.xsl warns about it: it is never presented)
// is a text node, which no stylesheet can hide and which the overview's grid would give a cell of its
// own. In an element it is neither; the rules that hide what is not a unit then hide it.
export function wrapStrayText(sectionList) {
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
}
