/**
 * Minimal pointer-based drag and drop (mouse, touch and pen alike; the HTML5 drag API has no touch support).
 * Start it from a handle's `pointerdown`. Drop zones are any elements with a `data-drop` attribute; the one
 * under the pointer gets `data-over` while hovered, and its `data-drop` value is passed to `onDrop`.
 * Browser-only (touches the DOM); not unit tested.
 */
export interface DragOptions {
  label: string;
  onDrop: (zone: string) => void;
  onEnd?: () => void;
}

const EDGE = 80;   // px from the viewport edge where dragging scrolls the page
const SPEED = 14;  // px per tick

export function startDrag(e: PointerEvent, opts: DragOptions): void {
  const handle = e.currentTarget as HTMLElement;
  handle.setPointerCapture(e.pointerId);

  const ghost = document.createElement('div');
  ghost.textContent = opts.label;
  ghost.className = 'rounded-lg bg-white px-3 py-2 text-[15px] shadow-lg ring-2 ring-ember dark:bg-dusk-card dark:text-slate-100';
  Object.assign(ghost.style, { position: 'fixed', zIndex: '60', pointerEvents: 'none', maxWidth: '75vw', transform: 'translate(-50%, -120%)' });
  document.body.appendChild(ghost);

  let x = e.clientX;
  let y = e.clientY;
  let over: HTMLElement | null = null;

  const zoneAt = () => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
  const paint = () => {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    const z = zoneAt();
    if (z !== over) { over?.removeAttribute('data-over'); z?.setAttribute('data-over', ''); over = z; }
  };
  const scroller = setInterval(() => {
    if (y < EDGE) window.scrollBy(0, -SPEED);
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, SPEED);
    else return;
    paint();
  }, 16);

  const move = (ev: PointerEvent) => { x = ev.clientX; y = ev.clientY; paint(); };
  const finish = (drop: boolean) => {
    clearInterval(scroller);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', cancel);
    const zone = drop ? zoneAt() : null;
    over?.removeAttribute('data-over');
    ghost.remove();
    if (zone?.dataset.drop) opts.onDrop(zone.dataset.drop);
    opts.onEnd?.();
  };
  const up = () => finish(true);
  const cancel = () => finish(false);

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', cancel);
  paint();
}
