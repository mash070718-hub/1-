let locks = 0;
let restorePage: (() => void) | undefined;
let pendingRestore: number | undefined;

/** Freeze the viewport, including on mobile browsers, without tracking a card. */
export function lockPageScroll() {
  if (pendingRestore !== undefined) {
    cancelAnimationFrame(pendingRestore);
    pendingRestore = undefined;
  }
  if (locks === 0) {
    const body = document.body;
    const root = document.documentElement;
    const x = window.scrollX;
    const y = window.scrollY;
    const width = root.clientWidth;
    const properties = ['position', 'top', 'left', 'width', 'overflow'] as const;
    const previous = properties.map(property => [property, body.style[property]] as const);
    const previousAnchor = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';
    body.style.position = 'fixed';
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = `${width}px`;
    body.style.overflow = 'hidden';

    restorePage = () => {
      for (const [property, value] of previous) body.style[property] = value;
      root.style.overflowAnchor = previousAnchor;
      const restorePosition = () => window.scrollTo({ left: x, top: y, behavior: 'instant' });
      restorePosition();
      // A save can reorder the list in the same React commit as the dialog closes.
      // Restore once more after layout, unless another dialog has taken over.
      pendingRestore = requestAnimationFrame(() => {
        pendingRestore = undefined;
        if (locks === 0) restorePosition();
      });
    };
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) {
      restorePage?.();
      restorePage = undefined;
    }
  };
}
