/**
 * Tiny dependency-free confetti burst. Draws to a transient full-screen
 * canvas and cleans itself up. Safe to call from anywhere on the client.
 */
export function fireConfetti(opts: { count?: number } = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Respect reduced-motion preferences.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const count = opts.count ?? 90;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const colors = ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#14b8a6', '#f43f5e'];

  interface P { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; }
  const originX = W / 2;
  const originY = H * 0.32;
  const parts: P[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    return {
      x: originX + (Math.random() - 0.5) * 80,
      y: originY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    };
  });

  const start = performance.now();
  const DURATION = 1800;

  function frame(now: number) {
    const elapsed = now - start;
    ctx!.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.22;         // gravity
      p.vx *= 0.99;         // drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }
    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}
