// SPDX-License-Identifier: CC0-1.0
//
// \footer{left}{centre}{right} (trees/meta/footer.tree) writes a hidden definition into a deck or a section; each
// slide takes the nearest one at or above its section and gets a footer drawn from it, with \var-section,
// \var-slide and the rest filled in for that slide. On the stage, in print and in the overview; not on the ordinary
// page. Title and bare slides have none unless they say \meta{footer}{show}, and any slide can say \meta{footer}{none}.
//
// Done once, when the page loads: a footer is part of its slide, so nothing here follows what is on show.

export function installFooters(deck) {
  const { slides } = deck;
  const { sectionsOf, titleOf, innermost, trailOf } = deck.shape;
  const { root } = deck;
  const { el } = deck.ui;

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
