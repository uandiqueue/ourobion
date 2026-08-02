/* Ourobion site — theme, asset swapping, the hero ring, and scroll choreography.
 *
 * The hero is hand-written Canvas 2D rather than three.js: the figure is a flat
 * parametric ring, so a WebGL scene graph would add ~600 KB and a build step to
 * draw something 2D already draws. It renders the brand's own geometry — 23
 * segments for the 23 chromosomes — and keeps the loop OPEN, which is the whole
 * point of the mark: the loop of understanding is never closed.
 *
 * Scroll behaviour is deliberately tied to that idea. Scrolling does not just
 * spin the ring; it WIDENS THE GAP. The further you read, the more open the loop
 * gets. Motion that argues the thesis beats motion that decorates it.
 */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ── theme ─────────────────────────────────────────────── */
  const stored = localStorage.getItem('ouro-theme');
  if (stored) root.dataset.theme = stored;
  else if (matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';

  const swaps = [
    ['[data-swap-mark]',    'assets/logo/ourobion-mark-'],
    ['[data-swap-lockup]',  'assets/logo/ourobion-lockup-'],
    ['[data-swap-biotope]', 'assets/logo/biotope-mark-'],
    ['[data-swap-nao]',     'assets/logo/nao-mark-'],
  ];

  function paintTheme() {
    const dark = root.dataset.theme === 'dark';
    const variant = dark ? 'dark' : 'light';
    for (const [sel, base] of swaps) {
      document.querySelectorAll(sel).forEach((img) => { img.src = `${base}${variant}.svg`; });
    }
    const icon = document.querySelector('[data-theme-icon]');
    if (icon) icon.textContent = dark ? '☀' : '☾';
  }

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ouro-theme', root.dataset.theme);
    paintTheme();
  });
  paintTheme();

  /* ── mark up sections for reveal (keeps the HTML clean) ── */
  const revealTargets = [
    ['#problem .cols', ''], ['#problem .criterion', 'scale'],
    ['#brain .two', ''], ['#brain .chain__note', ''],
    ['#evidence .stats', ''], ['#evidence .snapshot', ''], ['#evidence .two', ''],
    ['#products .two', ''], ['#products .access', ''],
    ['#limits .next', ''], ['#limits .goal', 'scale'],
    ['#team .team', ''],
  ];
  for (const [sel, mode] of revealTargets) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute('data-reveal', mode);
  }
  document.querySelectorAll('.band h2, .band .kicker, .band .lede').forEach((el) => {
    el.setAttribute('data-reveal', '');
  });
  // The chain is the one place a stagger says something: layers arriving in order.
  const chain = document.querySelector('.chain');
  if (chain) {
    chain.setAttribute('data-stagger', '');
    [...chain.children].forEach((li, i) => li.style.setProperty('--i', i));
  }
  document.querySelectorAll('.next, .team, .stats').forEach((g) => {
    g.setAttribute('data-stagger', '');
    [...g.children].forEach((c, i) => c.style.setProperty('--i', i));
  });

  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);          // reveal once; re-animating on every pass is noise
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('[data-reveal],[data-stagger]').forEach((el) => revealIO.observe(el));

  /* ── counting stats ────────────────────────────────────── */
  const countIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      countIO.unobserve(el);
      const target = Number(el.textContent.replace(/,/g, ''));
      if (!Number.isFinite(target) || reduced) return;
      const dur = 1100, t0 = performance.now();
      const tick = (t) => {
        const p = clamp((t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('.stat b').forEach((b) => countIO.observe(b));

  /* ── reading progress ──────────────────────────────────── */
  let bar = null;
  if (!reduced) {
    const rail = document.createElement('div');
    rail.className = 'progress';
    rail.innerHTML = '<div class="progress__bar"></div>';
    document.body.appendChild(rail);
    bar = rail.firstElementChild;
  }

  /* ── hero ring ─────────────────────────────────────────── */
  const canvas = document.querySelector('.hero__canvas');
  const hero = document.querySelector('.hero');
  const heroInner = document.querySelector('.hero__inner');
  const ctx = canvas?.getContext('2d');

  const SEGMENTS = 23;   // chromosomes — brand geometry, not decoration
  const BASE_GAP = 2;    // segments withheld at rest: the loop starts open
  const TAU = Math.PI * 2;

  let w = 0, h = 0, cx = 0, cy = 0, R = 0, dpr = 1;
  let scrollP = 0;       // 0 at top of hero → 1 when hero has left the viewport
  let docP = 0;          // whole-page reading progress

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h / 2;
    R = Math.min(w, h) * 0.315;
  }

  function readPalette() {
    const s = getComputedStyle(root);
    return [1, 2, 3, 4, 5].map((i) => s.getPropertyValue(`--ouro-coil-${i}`).trim()).filter(Boolean);
  }
  let coils = readPalette();
  new MutationObserver(() => { coils = readPalette(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  function draw(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // Scroll opens the loop: the withheld arc grows from 2 segments to ~9.
    const gap = BASE_GAP + scrollP * 7;
    const drawn = Math.max(3, Math.round(SEGMENTS - gap));
    const step = TAU / SEGMENTS;
    const spin = (reduced ? 0 : t * 0.00006) + scrollP * 1.5;   // and turns as you read
    const lift = 1 - scrollP * 0.22;                            // ring recedes slightly
    const dim  = 1 - scrollP * 0.55;

    for (let i = 0; i < drawn; i++) {
      const a0 = spin + i * step;
      const a1 = a0 + step * 0.82;
      const over = i % 2 === 0;
      const rr = (R + (over ? 7 : -7)) * lift;
      const colour = coils[i % coils.length];
      const fade = (0.22 + 0.78 * (1 - i / drawn)) * dim;

      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a1);
      ctx.strokeStyle = colour;
      ctx.globalAlpha = fade * 0.85;
      ctx.lineWidth = over ? 5.5 : 3.4;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, over ? 2.6 : 1.7, 0, TAU);
      ctx.fillStyle = colour;
      ctx.globalAlpha = fade;
      ctx.fill();
    }

    const pulse = reduced ? 0.5 : 0.5 + Math.sin(t * 0.0011) * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42 * lift);
    g.addColorStop(0, coils[0] || '#2BC4BE');
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = (0.1 + pulse * 0.1) * dim;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.42 * lift, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ── scroll wiring (rAF-coalesced; no work in the listener) ── */
  /* ── product identity blend ────────────────────────────
   * Each product card crossfades from the site palette into its own brand
   * palette as it crosses the viewport. --mix peaks at 1 while the card sits
   * in the middle band of the screen and eases back out at the edges, so the
   * two cards hand off rather than both sitting fully saturated at once. */
  const blendCards = [...document.querySelectorAll('[data-blend]')];
  const smooth = (p) => p * p * (3 - 2 * p);

  /* Measure where each mark must travel to sit at its card's centre. Done on
   * layout rather than guessed, so it survives responsive reflow and font swap.
   * Measurement happens at --form:1 (the settled state) to get true positions. */
  function measureCards() {
    for (const card of blendCards) {
      card.style.setProperty('--form', '1');
      const mark = card.querySelector('.product__mark');
      if (!mark) continue;
      const c = card.getBoundingClientRect();
      const m = mark.getBoundingClientRect();
      const dx = (c.left + c.width / 2) - (m.left + m.width / 2);
      const dy = (c.top + c.height / 2) - (m.top + m.height / 2);
      card.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      card.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      // Grow the mark to roughly a third of the card's short side.
      const grow = clamp(Math.min(c.width, c.height) * 0.34 / Math.max(1, m.width), 1.6, 5.5);
      card.style.setProperty('--grow', grow.toFixed(2));
      // Freeze the settled height so the card cannot collapse while the body is faded out.
      card.style.setProperty('--card-h', `${Math.round(c.height)}px`);
    }
  }

  function updateBlend() {
    const vh = innerHeight;
    for (const card of blendCards) {
      const r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) { card.style.setProperty('--mix', '0'); continue; }

      // mix: palette crossfade, peaks when the card is centred
      const centre = r.top + r.height / 2;
      const d = Math.abs(centre - vh / 2) / (vh / 2 + r.height / 2);
      card.style.setProperty('--mix', (reduced ? 1 : smooth(clamp(1 - d * 1.25))).toFixed(3));

      // form: assembly, monotonic — 0 as the card enters low, 1 once it has risen
      const form = reduced ? 1 : smooth(clamp((vh * 0.92 - r.top) / (vh * 0.55)));
      card.style.setProperty('--form', form.toFixed(3));
    }
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      updateBlend();
      const y = scrollY;
      if (hero) scrollP = clamp(y / Math.max(1, hero.offsetHeight));
      const max = document.documentElement.scrollHeight - innerHeight;
      docP = clamp(y / Math.max(1, max));
      if (bar) bar.style.transform = `scaleX(${docP})`;
      if (heroInner && !reduced) {
        heroInner.style.transform = `translateY(${scrollP * 46}px)`;
        heroInner.style.opacity = String(clamp(1 - scrollP * 1.35));
      }
      if (reduced) draw(0);   // keep the static frame in step with the gap
    });
  }

  let raf = null;
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    resize();
    blendCards.forEach((c) => c.style.removeProperty('--card-h'));  // re-measure from natural height
    measureCards();
    onScroll();
    if (reduced) draw(0);
  }, { passive: true });

  // Fonts change text metrics, which changes card height — re-measure once settled.
  document.fonts?.ready.then(() => { measureCards(); onScroll(); });

  if (canvas) {
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !raf && !reduced) raf = requestAnimationFrame(loop);
        else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
      }
    }, { threshold: 0 }).observe(canvas);

    resize();
    if (reduced) draw(0); else raf = requestAnimationFrame(loop);
  }

  // Paint the initial state even if the hero canvas is absent — the blend and the
  // progress rail must not depend on it.
  measureCards();
  onScroll();
})();
