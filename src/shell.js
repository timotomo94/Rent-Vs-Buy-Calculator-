// App shell: the slide-out inputs drawer on small screens, and offline support.
(function () {
  'use strict';

  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('backdrop');
  const openBtn = document.getElementById('open-drawer');
  const closeBtn = document.getElementById('close-drawer');
  const small = window.matchMedia('(max-width: 820px)');

  function setOpen(open) {
    document.body.classList.toggle('drawer-open', open);
    backdrop.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    // Off-screen drawer shouldn't be reachable by keyboard or screen readers.
    drawer.inert = small.matches && !open;
    if (open) closeBtn.focus();
    else if (small.matches && drawer.contains(document.activeElement)) openBtn.focus();
  }

  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) setOpen(false);
  });
  small.addEventListener('change', () => setOpen(false));
  setOpen(false);

  // Swipe right from the left edge to open; swipe left on the drawer to close.
  let start = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const open = document.body.classList.contains('drawer-open');
    if (!small.matches) return;
    if ((!open && t.clientX < 24) || (open && drawer.contains(e.target))) start = { x: t.clientX, y: t.clientY, open };
    else start = null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (!start.open && dx > 0) setOpen(true);
      if (start.open && dx < 0) setOpen(false);
    }
    start = null;
  }, { passive: true });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
