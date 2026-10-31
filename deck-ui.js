// SPDX-License-Identifier: CC0-1.0
//
// The small builders the parts of deck mode share: an element, a line icon, a button. deck-notes.js is handed these
// by deck.js (so it can be read, and tried, without importing anything); the rest import them.

export const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

// Small line icons, drawn to follow the text colour.
const ICONS = {
  copy: '<rect x="6" y="6" width="7.5" height="7.5" rx="1.5"/><path d="M3.5 10V4A1.5 1.5 0 0 1 5 2.5h5.5"/>',
  check: '<path d="M3 8.5l3.2 3.2L13 4.8"/>',
  hook: '<path d="M2.5 4h6a3.5 3.5 0 0 1 3.5 3.5V13"/><path d="M9.8 10.5L12 13l2.2-2.5"/>',
  grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
  notes: '<rect x="2.5" y="2" width="11" height="12" rx="1.5"/><path d="M5.2 5.5h5.6M5.2 8h5.6M5.2 10.5h3.4"/>',
};

export const icon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'deck-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
};

// A button that lets go of the keyboard focus once it has been clicked, so the deck's keys keep working.
export const button = (className, text, title, onclick) => {
  const b = el('button', className, text);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', () => { b.blur(); onclick(); });
  return b;
};
