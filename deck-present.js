// SPDX-License-Identifier: CC0-1.0
//
// The Present and Resume buttons, in the deck's metadata line on the page (with the Notes button between them, if the deck
// has notes). Present starts from the first slide, in full screen; when presenting stops anywhere but at the very start, a
// Resume button appears, with a note of where it would carry on from and a hook button that scrolls the page to that slide
// and flashes it. Presenting again clears it. Where you stopped is read from the state when 'deck:present' says presenting
// has stopped; nothing else has to tell this.

export function installPresent(deck) {
  const { root, slides, state, notes } = deck;
  const { describe } = deck.shape;
  const { el, button, icon } = deck.ui;

  let resume = null;

  const present = button('deck-present', '▶ Present', `Present this deck from the start (${slides.length} slides). Links such as #slide-3 open it on that slide.`, () => {
    deck.enter(0);
    deck.enterFullscreen();
  });
  const resumeButton = button('deck-present', '↩ Resume', 'Carry on from where you stopped', () => {
    if (!resume) return;
    deck.enter(resume.index, resume.step);
    deck.enterFullscreen();
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

  document.addEventListener('deck:present', (e) => {
    // Where to pick up again, unless that is just the start.
    resume = e.detail.on || !(state.current > 0 || state.step > 0) ? null : { index: state.current, step: state.step };
    updateResume();
  });

  const metadata = root.querySelector(':scope > details > summary > header .metadata ul');
  if (metadata) {
    metadata.append(presentItem, ...(notes.has ? [notes.pageItem] : []), resumeItem);
  } else {
    root.querySelector(':scope > details > summary > header')?.append(present, ...(notes.has ? [notes.pageItem] : []), resumeItem);
  }
}
