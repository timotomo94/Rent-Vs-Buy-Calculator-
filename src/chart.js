// Minimal SVG line chart with a crosshair that snaps to chosen data points and
// one tooltip listing every series.
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const M = { top: 16, right: 20, bottom: 36, left: 64 };

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
      ticks.push(Math.round(v / step) * step);
    }
    return ticks;
  }

  function compactGBP(v) {
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    if (a >= 1e6) return sign + '£' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return sign + '£' + Math.round(a / 1e3) + 'K';
    return sign + '£' + Math.round(a);
  }

  function linePath(xs, ys, x, y) {
    let d = '';
    for (let i = 0; i < xs.length; i++) d += (i ? 'L' : 'M') + x(xs[i]).toFixed(1) + ',' + y(ys[i]).toFixed(1);
    return d;
  }

  // opts: {
  //   xs, xTicks, xFormat(v), xTitle,
  //   series: [{label, values, cls}], band: {lo, hi}, polarity: bool (shade below zero),
  //   markers: [{x, label, cls, row}], snap: [index] (hover positions, default all),
  //   tooltip(index) -> {title, rows: [{label, value, cls}]}, focusIndex, ariaLabel }
  function render(container, opts) {
    container.textContent = '';
    const width = Math.max(280, container.clientWidth);
    const height = width < 520 ? 280 : 360;
    const w = width - M.left - M.right;
    const h = height - M.top - M.bottom;

    const xs = opts.xs;
    const xMin = xs[0], xMax = xs[xs.length - 1];
    let lo = 0, hi = 0;
    const all = opts.series.map((s) => s.values);
    if (opts.band) all.push(opts.band.lo, opts.band.hi);
    for (const arr of all) for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const yTicks = niceTicks(lo, hi, 5);
    const y0 = yTicks[0], y1 = yTicks[yTicks.length - 1];

    const x = (v) => M.left + ((v - xMin) / (xMax - xMin)) * w;
    const y = (v) => M.top + h - ((v - y0) / (y1 - y0)) * h;

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': opts.ariaLabel || '' }, container);

    for (const t of yTicks) {
      el('line', { x1: M.left, x2: M.left + w, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }, svg);
      const lab = el('text', { x: M.left - 8, y: y(t), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
      lab.textContent = compactGBP(t);
    }
    const minGap = 44;
    let lastX = -Infinity;
    for (const t of opts.xTicks) {
      if (x(t) - lastX < minGap) continue;
      lastX = x(t);
      const lab = el('text', { x: x(t), y: M.top + h + 20, class: 'tick', 'text-anchor': 'middle' }, svg);
      lab.textContent = opts.xFormat(t);
    }
    const xTitle = el('text', { x: M.left + w, y: height - 2, class: 'tick', 'text-anchor': 'end' }, svg);
    xTitle.textContent = opts.xTitle;

    if (opts.band) {
      const d = linePath(xs, opts.band.hi, x, y) + linePath(xs.slice().reverse(), opts.band.lo.slice().reverse(), x, y).replace('M', 'L') + 'Z';
      el('path', { d, class: 'band' }, svg);
    }

    if (opts.polarity) {
      const zy = y(0);
      el('rect', { x: M.left, y: zy, width: w, height: Math.max(0, M.top + h - zy), class: 'fill-neg' }, svg);
      const lab = el('text', { x: M.left + w - 8, y: zy + 18, class: 'zone-label', 'text-anchor': 'end' }, svg);
      lab.textContent = 'Renting wins';
      const lab2 = el('text', { x: M.left + w - 8, y: zy - 8, class: 'zone-label', 'text-anchor': 'end' }, svg);
      lab2.textContent = 'Buying wins';
    }

    for (const m of opts.markers || []) {
      if (m.x == null || m.x < xMin || m.x > xMax) continue;
      el('line', { x1: x(m.x), x2: x(m.x), y1: M.top, y2: M.top + h, class: 'marker ' + (m.cls || '') }, svg);
      const flip = x(m.x) > M.left + w * 0.75;
      const lab = el('text', { x: x(m.x) + (flip ? -6 : 6), y: M.top + 12 + (m.row || 0) * 16, class: 'marker-label', 'text-anchor': flip ? 'end' : 'start' }, svg);
      lab.textContent = m.label;
    }

    for (const s of opts.series) {
      el('path', { d: linePath(xs, s.values, x, y), class: 'line ' + s.cls }, svg);
    }

    // Hover layer
    const snap = opts.snap || xs.map((_, i) => i);
    const cross = el('line', { y1: M.top, y2: M.top + h, class: 'crosshair', visibility: 'hidden' }, svg);
    const dots = opts.series.map((s) => el('circle', { r: 4.5, class: 'dot ' + s.cls, visibility: 'hidden' }, svg));
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    container.appendChild(tip);

    let current = null; // position in snap
    function show(k) {
      current = k;
      const i = snap[k];
      const px = x(xs[i]);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px);
      cross.setAttribute('visibility', 'visible');
      opts.series.forEach((s, j) => {
        dots[j].setAttribute('cx', px); dots[j].setAttribute('cy', y(s.values[i]));
        dots[j].setAttribute('visibility', 'visible');
      });
      const t = opts.tooltip(i);
      tip.textContent = '';
      const head = document.createElement('div');
      head.className = 'tt-title';
      head.textContent = t.title;
      tip.appendChild(head);
      for (const r of t.rows) {
        const row = document.createElement('div');
        row.className = 'tt-row';
        const key = document.createElement('span');
        key.className = 'tt-key ' + (r.cls || 'none');
        const val = document.createElement('strong');
        val.textContent = r.value;
        const lab = document.createElement('span');
        lab.className = 'tt-label';
        lab.textContent = r.label;
        row.append(key, val, lab);
        tip.appendChild(row);
      }
      tip.hidden = false;
      const tw = tip.offsetWidth;
      const left = px + 12 + tw > width ? px - 12 - tw : px + 12;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = M.top + 'px';
    }
    function hide() {
      current = null;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    }
    function nearest(value) {
      let best = 0;
      for (let k = 1; k < snap.length; k++) {
        if (Math.abs(xs[snap[k]] - value) < Math.abs(xs[snap[best]] - value)) best = k;
      }
      return best;
    }

    const hit = el('rect', { x: M.left, y: M.top, width: w, height: h, class: 'hit', tabindex: 0 }, svg);
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * width;
      show(nearest(xMin + ((px - M.left) / w) * (xMax - xMin)));
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    hit.addEventListener('focus', () => show(nearest(opts.focusX != null ? opts.focusX : xMin)));
    hit.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = (current == null ? 0 : current) + (e.key === 'ArrowRight' ? 1 : -1);
      show(Math.min(snap.length - 1, Math.max(0, next)));
    });
  }

  root.LineChart = { render, compactGBP };
})(window);
