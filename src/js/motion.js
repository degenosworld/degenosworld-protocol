export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// damped harmonic oscillator, semi-implicit Euler at a fixed step
export function spring(from, to, { k = 170, c = 18, m = 1 } = {}, onTick, onDone) {
  let x = from, v = 0, last = performance.now(), acc = 0, raf = 0, dead = false;
  const dt = 1 / 120;
  const frame = now => {
    if (dead) return;
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    while (acc >= dt) { v += (-k * (x - to) - c * v) / m * dt; x += v * dt; acc -= dt; }
    if (Math.abs(v) < 0.002 && Math.abs(x - to) < 0.001) { onTick(to); if (onDone) onDone(); return; }
    onTick(x); raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

export function initReveal() {
  const els = [...document.querySelectorAll('.rv')];
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach(e => { e.style.opacity = 1; }); return; }
  const apply = (e, p) => { e.style.opacity = Math.max(0, Math.min(1, p)); e.style.transform = `translate3d(0,${(1 - p) * 28}px,0)`; };
  els.forEach(e => apply(e, 0));
  let fired = false;
  setTimeout(() => { if (!fired) els.forEach(e => { e.style.opacity = 1; e.style.transform = ''; }); }, 3500);
  const io = new IntersectionObserver(entries => {
    fired = true;
    entries.filter(en => en.isIntersecting).forEach((en, i) => {
      const e = en.target; io.unobserve(e);
      const siblings = e.parentElement ? [...e.parentElement.children].filter(c => c.classList.contains('rv')) : [e];
      const idx = Math.max(0, siblings.indexOf(e));
      const delay = Math.min(idx, 6) * 70 + i * 20;
      const settle = () => { e.style.transform = ''; e.style.opacity = 1; };
      setTimeout(() => { spring(0, 1, {}, p => apply(e, p), settle); setTimeout(settle, 1600); }, delay);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}

export function initProgress() {
  const bar = document.getElementById('progress'); if (!bar) return;
  let ticking = false;
  const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd); upd();
}

export function initParallax() {
  if (reduced()) return;
  const hero = document.querySelector('.hero'); if (!hero) return;
  const layers = [...hero.querySelectorAll('.layer')];
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, raf = 0;
  const loop = () => {
    px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    layers.forEach(l => { const d = +l.dataset.depth || 0.5; l.style.transform = `translate3d(${px * 24 * d}px,${py * 24 * d - sy * 0.12 * d}px,0)`; });
    raf = (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick(); });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  addEventListener('scroll', () => { sy = Math.min(scrollY, hero.offsetHeight); kick(); }, { passive: true });
}

export function initSpotlight(root = document) {
  root.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('.spot,.row'); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}

// number tween with change flash
export function tweenNumber(el, to, fmt, dur = 700) {
  const from = el._v;
  el._v = to;
  if (from === undefined || reduced()) { el.textContent = fmt(to); return; }
  if (from === to) return;
  el.classList.remove('flash-up', 'flash-dn'); void el.offsetWidth;
  el.classList.add(to > from ? 'flash-up' : 'flash-dn');
  const t0 = performance.now();
  cancelAnimationFrame(el._raf);
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) el._raf = requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  el._raf = requestAnimationFrame(step);
  setTimeout(() => { if (el._v === to) el.textContent = fmt(to); }, dur + 120);
}
