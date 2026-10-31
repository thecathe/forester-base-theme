// SPDX-License-Identifier: CC0-1.0
//
// Links to other trees of the forest, in a deck that is shown or printed away from it. Another tree's page is not somewhere to
// go from a talk: from the stage it would take the talk's page away, and in a PDF the forest may not be served where it was
// printed (a local address, or one that is private). So while presenting, and while printing, a link to another tree goes
// where that tree itself leads: its \meta{redirect}, else its first \meta{external}. A tree that leads nowhere is plain text.
// The build wrote where on the link (data-leads-to, see links.xsl: empty when nowhere); a link without it, one to a slide of
// the deck and one to another site are left as they are.
//
// followTargets(root) does it and returns what undoes it. It is on for the stage from when presenting starts to when it
// stops (here), and for printing from beforeprint to afterprint (deck-print.js, given `follow`), so a PDF made by Firefox, by
// Chromium and by deck-pdf.py all follow the same rule, and so does a click on the stage. A page that is not presented or
// printed keeps its links to the forest.

const LEADS = 'a[data-leads-to]';

// Points each such link in `root` where its tree leads, or takes its address away (deck.css draws it as the text it is).
// Returns the function that puts every link back as it was.
export function followTargets(root) {
  const undo = [];
  for (const a of root.querySelectorAll(LEADS)) {
    const href = a.getAttribute('href');
    const to = a.dataset.leadsTo;
    if (to) {
      a.setAttribute('href', to);
      undo.push(() => a.setAttribute('href', href));
    } else {
      a.removeAttribute('href');
      a.classList.add('deck-unlinked');
      undo.push(() => {
        a.setAttribute('href', href);
        a.classList.remove('deck-unlinked');
      });
    }
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
  return { follow: () => followTargets(deck.root) };
}
