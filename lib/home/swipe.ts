/**
 * Swipe a row sideways to dismiss it. Start it from the row content's `pointerdown`; the row (`target`) follows
 * the finger and, once moved past `threshold` px either way, `onSwipe` runs. Anything shorter springs back.
 * Vertical scrolling is left to the browser (give the content `touch-pan-y`). Browser-only; not unit tested.
 */
export function startSwipe(e: PointerEvent, target: HTMLElement, onSwipe: () => void, threshold = 90): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const handle = e.currentTarget as HTMLElement;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let dx = 0;
  let swiping = false;

  const move = (ev: PointerEvent) => {
    dx = ev.clientX - x0;
    if (!swiping) {
      if (Math.abs(ev.clientY - y0) > 12 && Math.abs(dx) < 12) return finish(false); // a scroll, not a swipe
      if (Math.abs(dx) < 12) return;
      swiping = true;
      handle.setPointerCapture(ev.pointerId);
      target.style.transition = 'none';
    }
    target.style.transform = `translateX(${dx}px)`;
    target.style.opacity = String(1 - Math.min(Math.abs(dx) / (threshold * 2), 0.6));
  };
  const finish = (commit: boolean) => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', cancel);
    target.style.transition = 'transform 150ms, opacity 150ms';
    target.style.transform = '';
    target.style.opacity = '';
    if (commit && Math.abs(dx) >= threshold) onSwipe();
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', cancel);
}
