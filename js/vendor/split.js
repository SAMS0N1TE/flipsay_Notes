

















export function createSplit({
  container,
  direction = 'horizontal',
  children,
  sizes,
  minSizes,
  storageKey = null,
  gutterSize = 6,
}) {
  const isHorizontal = direction === 'horizontal';
  const axis = isHorizontal ? 'clientX' : 'clientY';
  const cursor = isHorizontal ? 'col-resize' : 'row-resize';

  const els = children.map(c => typeof c === 'string' ? container.querySelector(c) : c);
  if (els.some(el => !el)) {
    console.warn('createSplit: missing children', children);
    return null;
  }

  container.style.display = 'flex';
  container.style.flexDirection = isHorizontal ? 'row' : 'column';


  let currentSizes = [...sizes];
  if (storageKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved) && saved.length === sizes.length) currentSizes = saved;
    } catch (_) {}
  }

  function applySizes() {
    els.forEach((el, i) => {
      el.style.flex = `${currentSizes[i]} 1 0`;
      if (isHorizontal) {
        el.style.minWidth = `${minSizes[i]}px`;
        el.style.minHeight = '0';
      } else {
        el.style.minHeight = `${minSizes[i]}px`;
        el.style.minWidth = '0';
      }
      el.style.overflow = 'hidden';
    });
  }
  applySizes();

  for (let i = 0; i < els.length - 1; i++) {
    const gutter = document.createElement('div');
    gutter.className = `split-gutter split-gutter-${direction}`;
    gutter.style.cssText = `
      flex: 0 0 ${gutterSize}px;
      background: var(--OD);
      cursor: ${cursor};
      position: relative;
      z-index: 5;
      transition: background 0.1s;
    `;
    const handle = document.createElement('div');
    handle.style.cssText = isHorizontal
      ? `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:30px;background:var(--OB);`
      : `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:2px;background:var(--OB);`;
    gutter.appendChild(handle);

    let dragging = false;
    let startPos = 0;
    let startA = 0;
    let startB = 0;

    gutter.addEventListener('mouseenter', () => { if (!dragging) gutter.style.background = 'var(--O)'; });
    gutter.addEventListener('mouseleave', () => { if (!dragging) gutter.style.background = 'var(--OD)'; });

    const onMove = (e) => {
      if (!dragging) return;
      const ev = e.touches ? e.touches[0] : e;
      const rect = container.getBoundingClientRect();
      const containerSize = isHorizontal ? rect.width : rect.height;
      const delta = ev[axis] - startPos;
      const deltaPct = delta / containerSize * 100;

      let newA = startA + deltaPct;
      let newB = startB - deltaPct;
      const minAPct = (minSizes[i] / containerSize) * 100;
      const minBPct = (minSizes[i + 1] / containerSize) * 100;
      if (newA < minAPct) { newB -= (minAPct - newA); newA = minAPct; }
      if (newB < minBPct) { newA -= (minBPct - newB); newB = minBPct; }

      currentSizes[i]     = newA;
      currentSizes[i + 1] = newB;
      applySizes();
      window.dispatchEvent(new Event('resize'));
    };

    const onUp = () => {
      dragging = false;
      gutter.style.background = 'var(--OD)';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(currentSizes)); } catch (_) {}
      }
    };

    const onDown = (e) => {
      e.preventDefault();
      dragging = true;
      const ev = e.touches ? e.touches[0] : e;
      startPos = ev[axis];
      startA = currentSizes[i];
      startB = currentSizes[i + 1];
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend',  onUp);
    };

    gutter.addEventListener('mousedown',  onDown);
    gutter.addEventListener('touchstart', onDown, { passive: false });

    els[i].after(gutter);
  }

  return {
    getSizes: () => [...currentSizes],
    setSizes: (s) => { currentSizes = [...s]; applySizes(); },
  };
}
