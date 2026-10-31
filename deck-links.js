// SPDX-License-Identifier: CC0-1.0
//
// Links to other trees of the forest, in a deck that is shown or printed away from it. Another tree's page is not somewhere to
// go from a talk: from the stage it would take the talk's page away, and in a PDF the forest may not be served where it was
// printed (a local address, or one that is private). So while presenting, and while printing, a link to another tree goes
// where that tree itself leads: its \meta{redirect}, else its first \meta{external}. A tree that leads nowhere is plain text.
// The build wrote where on the link (data-leads-to, see links.xsl: empty when nowhere); a link without it and one to another
// site are left as they are.
//
// A link to a slide of the deck (#slide-3, a \goto, an \agenda entry) is a jump in a PDF from Chromium, and is left as it is
// there. Firefox's PDF cannot jump within itself: it keeps the link as the address of the page it was printed from, which is
// somewhere the PDF is not read (a local server, say). So printing from Firefox takes those links out too, and the words stay.
//
// followTargets(root) does it and returns what undoes it. It is on for the stage from when presenting starts to when it
// stops (here), and for printing from beforeprint to afterprint (deck-print.js, given `follow`), so a PDF made by Firefox, by
// Chromium and by deck-pdf.py all follow the same rule, and so does a click on the stage. A page that is not presented or
// printed keeps its links to the forest.

const LEADS = 'a[data-leads-to]';

// Whether the browser makes a link to the page's own address (a link to a slide) into a jump within a PDF it prints.
// Firefox does not; Chromium does (deck-print.js puts the ids it jumps to).
const PRINT_JUMPS = !/Firefox\//.test(navigator.userAgent);

// A link to a place in this very page: the same address but for the fragment.
function toThisPage(a) {
  try {
    const to = new URL(a.getAttribute('href'), location.href);
    return to.hash !== '' && to.origin === location.origin && to.pathname === location.pathname && to.search === location.search;
  } catch {
    return false;
  }
}

// Takes a link's address away, so that it is the text it holds (deck.css draws it as such); pushes what puts it back.
function unlink(a, undo) {
  const href = a.getAttribute('href');
  a.removeAttribute('href');
  a.classList.add('deck-unlinked');
  undo.push(() => {
    a.setAttribute('href', href);
    a.classList.remove('deck-unlinked');
  });
}

// Points each such link in `root` where its tree leads, or takes its address away. With `jumps` false, the links to a place in
// this page go too (for a print that cannot make them jumps). Returns the function that puts every link back as it was.
export function followTargets(root, { jumps = true } = {}) {
  const undo = [];
  for (const a of root.querySelectorAll(LEADS)) {
    const to = a.dataset.leadsTo;
    if (to) {
      const href = a.getAttribute('href');
      a.setAttribute('href', to);
      undo.push(() => a.setAttribute('href', href));
    } else {
      unlink(a, undo);
    }
  }
  if (!jumps) {
    for (const a of root.querySelectorAll('a[href]')) if (toThisPage(a)) unlink(a, undo);
  }
  return () => undo.forEach((f) => f());
}

export function installLinks(deck) {
  let undo = null;
  document.addEventListener('deck:present', (e) => {
    if (e.detail.on) {
      undo ??= followTargets(deck.root);
    } else {
      undo?.();
      undo = null;
    }
  });
  return { follow: () => followTargets(deck.root, { jumps: PRINT_JUMPS }) };
}
