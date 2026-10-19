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
  function readSelection(selection = window.getSelection()) {
    if (!selection || selection.isCollapsed || !selection.rangeCount || isEditable(selection.anchorNode) || isEditable(selection.focusNode)) return null;
    const text = selection.toString().trim();
    if (!text) return null;
    const range = selection.getRangeAt(0);
    // A dragged range can cross an editor even when both endpoints are outside it.
    if (range.cloneContents().querySelector?.('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return null;
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return {text, rect: {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom}};
  }
  globalThis.MetaFrasiSelection = Object.freeze({isEditable, readSelection});
})();
