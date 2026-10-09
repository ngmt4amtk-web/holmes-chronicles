// Pages conserve every grapheme. Their capacity comes from the rendered text
// area, including the actual font, line spacing, device width and available height.
const opening = /[「『（［｛〈《【〔“‘]$/u;
const closing = /^[、。，．！？!?：；:;」』）］｝〉》】〕”’々ーぁぃぅぇぉっゃゅょァィゥェォッャュョ]/u;
const sentenceEnd = /[。！？!?\n][」』）”’]*$/u;
const clauseEnd = /[、，,；;：:]$/u;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;

export function splitToFit(text, fits) {
  const chars = segmenter ? Array.from(segmenter.segment(text), x => x.segment) : Array.from(text);
  if (!chars.length) return [''];
  const pages = [];
  let start = 0;
  while (start < chars.length) {
    // A bounded search avoids laying out an entire chapter for every page.
    let low = 0, high = Math.min(360, chars.length - start);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (fits(chars.slice(start, start + mid).join(''))) low = mid;
      else high = mid - 1;
    }
    if (!low) throw new Error('The text area cannot display one character.');
    let end = start + low;
    if (end < chars.length) {
      const earliest = start + Math.max(1, Math.floor(low * .55));
      // Do not start a new page with punctuation or leave an opening bracket.
      const legal = at => !closing.test(chars[at] || '') && !opening.test(chars[at - 1] || '');
      let preferred = 0;
      for (let at = end; at >= earliest; at--) {
        if (legal(at) && sentenceEnd.test(chars.slice(Math.max(start, at - 5), at).join(''))) { preferred = at; break; }
      }
      if (!preferred) {
        for (let at = end; at >= start + Math.ceil(low * .8); at--) {
          if (legal(at) && clauseEnd.test(chars[at - 1])) { preferred = at; break; }
        }
      }
      if (preferred) end = preferred;
      else while (end > start + 1 && !legal(end)) end--;
    }
    pages.push(chars.slice(start, end).join(''));
    start = end;
  }
  return pages;
}

export function paginateElement(text, element) {
  const rect = element.getBoundingClientRect();
  const probe = element.cloneNode(false);
  probe.removeAttribute('id');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed', left: '-20000px', top: '0', visibility: 'hidden',
    width: `${rect.width}px`, height: 'auto', minHeight: '0', maxHeight: 'none',
    margin: '0', overflow: 'visible', pointerEvents: 'none'
  });
  element.parentNode.appendChild(probe);
  try {
    return splitToFit(text, candidate => {
      probe.textContent = candidate;
      return probe.getBoundingClientRect().height <= rect.height - 1 && probe.scrollWidth <= rect.width + .5;
    });
  } finally { probe.remove(); }
}

export function pageAtOffset(pages, offset) {
  let count = 0;
  for (let i = 0; i < pages.length; i++) {
    count += pages[i].length;
    if (offset < count) return i;
  }
  return Math.max(0, pages.length - 1);
}
