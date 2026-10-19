/* Shared between the isolated content script and browser tests. */
(() => {
  function parentElementAcrossRoots(node) {
    return node?.parentElement || node?.getRootNode?.()?.host || null;
  }
  function isEditable(node) {
    let current = node?.nodeType === 1 ? node : node?.parentElement;
    while (current) {
      if (current.matches?.('input, textarea, select, [role="textbox"], [role="searchbox"], [contenteditable]:not([contenteditable="false"])') || current.isContentEditable) return true;
      current = parentElementAcrossRoots(current);
    }
    return document.designMode === 'on';
  }
  function orderedMarker(item, style) {
    const list = item.parentElement;
    const items = [...list.children].filter(child => child.tagName === 'LI');
    const step = list.reversed ? -1 : 1;
    let number = list.hasAttribute('start') ? list.start : list.reversed ? items.length : 1;
    for (const sibling of items) {
      if (sibling.hasAttribute('value')) number = sibling.value;
      if (sibling === item) break;
      number += step;
    }
    if (/^(lower|upper)-(alpha|latin)$/.test(style) && number > 0) {
      let label = '';
      for (let n = number; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(97 + (n - 1) % 26) + label;
      return (style.startsWith('upper') ? label.toUpperCase() : label) + '.';
    }
    if (/^(lower|upper)-roman$/.test(style) && number > 0 && number < 4000) {
      let label = '', n = number;
      for (const [value, letters] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
        while (n >= value) { label += letters; n -= value; }
      }
      return (style.startsWith('lower') ? label.toLowerCase() : label) + '.';
    }
    return `${number}.`;
  }
  function selectedTextWithLists(range, fallback) {
    let root = range.commonAncestorContainer;
    if (root.nodeType !== 1) root = root.parentElement;
    if (!root) return fallback;
    const enclosingItem = root.closest('li');
    if (enclosingItem && !root.querySelector('li')) {
      // Keep word/phrase selections within a list as words/phrases.
      const compact = text => text.replace(/\s+/g, ' ').trim();
      if (compact(enclosingItem.innerText) !== compact(fallback)) return fallback;
      root = enclosingItem;
    }
    if (!root.matches('li') && ![...root.querySelectorAll('li')].some(item => range.intersectsNode(item))) return fallback;
    function render(node, depth = 0, omitLists = false) {
      if (!range.intersectsNode(node)) return '';
      if (node.nodeType === 3) {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        const text = node.data.slice(start, end);
        if (/^(UL|OL)$/.test(node.parentElement?.tagName) && !text.trim()) return '';
        const whitespace = getComputedStyle(node.parentElement).whiteSpace;
        return /^(pre|pre-wrap|break-spaces)$/.test(whitespace) ? text : text.replace(/[\t\n\r\f ]+/g, ' ');
      }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(node.tagName)) return '';
      if (omitLists && /^(UL|OL)$/.test(node.tagName)) return '';
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return '';
      if (node.tagName === 'BR') return '\n';
      const isItem = node.tagName === 'LI';
      const body = [...node.childNodes].map(child => render(child, depth + (isItem ? 1 : 0), omitLists)).join('');
      if (isItem) {
        if (!body.trim()) return '';
        // A selection starting inside a nested list must not invent an empty parent item.
        const ownSelectedText = [...node.childNodes].map(child => render(child, depth + 1, true)).join('').trim();
        if (!ownSelectedText) return body;
        const marker = style.listStyleType === 'none' ? '' : node.parentElement?.tagName === 'OL'
          ? orderedMarker(node, style.listStyleType)
          : style.listStyleType === 'circle' ? '◦' : style.listStyleType === 'square' ? '▪' : '•';
        return `${'  '.repeat(depth)}${marker ? marker + ' ' : ''}${body.trim()}\n`;
      }
      if (/^(UL|OL|P|DIV|SECTION|ARTICLE|H[1-6]|BLOCKQUOTE|PRE|TR)$/.test(node.tagName)) return `\n${body.trimEnd()}\n`;
      return body;
    }
    return render(root).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || fallback;
  }
  function readSelection(selection = window.getSelection()) {
    if (!selection || selection.isCollapsed || !selection.rangeCount || isEditable(selection.anchorNode) || isEditable(selection.focusNode)) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const range = selection.getRangeAt(0);
    // A dragged range can cross an editor even when both endpoints are outside it.
    if (range.cloneContents().querySelector?.('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return null;
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return {text: selectedTextWithLists(range, text), rect: {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom}};
  }
  globalThis.MetaFrasiSelection = Object.freeze({isEditable, readSelection});
})();
