// Minimal SVG charts: a line chart with a crosshair that snaps to chosen data
// points, and a heatmap of a value over (x, years). Both show one tooltip.
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

  // null values break the line.
  function linePath(xs, ys, x, y) {
    let d = '';
    let pen = false;
    for (let i = 0; i < xs.length; i++) {
      if (ys[i] == null) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + x(xs[i]).toFixed(1) + ',' + y(ys[i]).toFixed(1);
      pen = true;
    }
    return d;
  }

  // Fills a tooltip from {title, rows: [{label, value, cls}]}.
  function fillTooltip(tip, t) {
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
      if (r.color) key.style.background = r.color;
      const val = document.createElement('strong');
      val.textContent = r.value;
      const lab = document.createElement('span');
      lab.className = 'tt-label';
      lab.textContent = r.label;
      row.append(key, val, lab);
      tip.appendChild(row);
    }
    tip.hidden = false;
  }

  function placeTooltip(tip, px, py, width) {
    const tw = tip.offsetWidth;
    const left = px + 12 + tw > width ? px - 12 - tw : px + 12;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = py + 'px';
  }

  function chartSize(container) {
    const width = Math.max(280, container.clientWidth);
    const height = width < 520 ? 250 : 360;
    return { width, height, w: width - M.left - M.right, h: height - M.top - M.bottom };
  }

  function xAxis(svg, opts, x, width, height, h) {
    const minGap = 44;
    let lastX = -Infinity;
    for (const t of opts.xTicks) {
      if (x(t) - lastX < minGap) continue;
      lastX = x(t);
      const lab = el('text', { x: x(t), y: M.top + h + 20, class: 'tick', 'text-anchor': 'middle' }, svg);
      lab.textContent = opts.xFormat(t);
    }
    const xTitle = el('text', { x: width - M.right, y: height - 2, class: 'tick', 'text-anchor': 'end' }, svg);
    xTitle.textContent = opts.xTitle;
  }

  // opts: {
  //   xs, xTicks, xFormat(v), xTitle, series: [{label, values, cls}], band: {lo, hi},
  //   polarity: bool (shade below zero), markers: [{x, label, cls, row}],
  //   snap: [index] (hover positions, default all),
  //   tooltip(index) -> {title, rows: [{label, value, cls}]}, focusX, ariaLabel }
  function render(container, opts) {
    container.textContent = '';
    const { width, height, w, h } = chartSize(container);

    const xs = opts.xs;
    const xMin = xs[0], xMax = xs[xs.length - 1];
    let lo = 0, hi = 0;
    const all = opts.series.map((s) => s.values);
    if (opts.band) all.push(opts.band.lo, opts.band.hi);
    for (const arr of all) for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const yTicks = niceTicks(lo, hi, 5);
    const y0 = yTicks[0], y1 = yTicks[yTicks.length - 1];

    const x = (v) => M.left + ((v - xMin) / (xMax - xMin)) * w;
    const y = (v) => M.top + h - ((Math.min(y1, Math.max(y0, v)) - y0) / (y1 - y0)) * h;

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': opts.ariaLabel || '' }, container);

    for (const t of yTicks) {
      el('line', { x1: M.left, x2: M.left + w, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }, svg);
      const lab = el('text', { x: M.left - 8, y: y(t), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
      lab.textContent = compactGBP(t);
    }
    xAxis(svg, opts, x, width, height, h);

    if (opts.band) {
      const d = linePath(xs, opts.band.hi, x, y) + linePath(xs.slice().reverse(), opts.band.lo.slice().reverse(), x, y).replace('M', 'L') + 'Z';
      el('path', { d, class: 'band' }, svg);
    }

    if (opts.polarity) {
      const zy = y(0);
      el('rect', { x: M.left, y: zy, width: w, height: Math.max(0, M.top + h - zy), class: 'fill-neg' }, svg);
      const lab = el('text', { x: M.left + 8, y: M.top + h - 8, class: 'zone-label' }, svg);
      lab.textContent = 'Renting wins';
      const lab2 = el('text', { x: M.left + 8, y: zy - 8, class: 'zone-label' }, svg);
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
      fillTooltip(tip, opts.tooltip(i));
      placeTooltip(tip, px, M.top, width);
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

  function hexRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Diverging colour for v: grey at 0, toward `pos` above and `neg` below,
  // strongest at ±scale. It stops short of the full pole colour so large areas
  // stay calm and the lines drawn on top keep their contrast.
  function divergingColor(v, scale, c) {
    const t = Math.min(1, Math.abs(v) / scale);
    const k = 0.8 * Math.pow(t, 0.85);
    const pole = v >= 0 ? c.pos : c.neg;
    return c.mid.map((m, i) => Math.round(m + (pole[i] - m) * k));
  }

  function heatColors() {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => hexRgb(css.getPropertyValue(name).trim());
    return { pos: get('--div-pos'), mid: get('--div-mid'), neg: get('--div-neg') };
  }

  // Heatmap of a value over x (columns) and time (rows, one per month).
  // opts: {
  //   xs, months, grid: [column][month] values, scale, years (y-axis top),
  //   xTicks, xFormat(v), xTitle, curve: [years | null] per column (drawn as a line),
  //   hLines: [{y, label}], markers: [{x, label}],
  //   tooltip(col, month, color) -> {title, rows}, focus: {x, month}, ariaLabel }
  function renderHeatmap(container, opts) {
    container.textContent = '';
    const { width, height, w, h } = chartSize(container);
    const xs = opts.xs;
    const cols = xs.length, months = opts.months;
    const xMin = xs[0], xMax = xs[cols - 1];
    const x = (v) => M.left + ((v - xMin) / (xMax - xMin)) * w;
    const y = (yrs) => M.top + h - (Math.min(opts.years, Math.max(0, yrs)) / opts.years) * h;
    const colors = heatColors();
    const rgb = (v) => 'rgb(' + divergingColor(v, opts.scale, colors).join(',') + ')';

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': opts.ariaLabel || '' }, container);

    // One pixel per cell, scaled up with smoothing. Cells are centred on their
    // x / month, so the image overhangs by half a cell and is clipped.
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = months + 1;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cols, months + 1);
    for (let c = 0; c < cols; c++) {
      for (let m = 0; m <= months; m++) {
        const [r, g, b] = divergingColor(opts.grid[c][m], opts.scale, colors);
        const i = ((months - m) * cols + c) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const cw = w / (cols - 1), ch = h / months;
    const id = 'c' + Math.random().toString(36).slice(2);
    const clip = el('clipPath', { id }, el('defs', {}, svg));
    el('rect', { x: M.left, y: M.top, width: w, height: h }, clip);
    el('image', {
      href: canvas.toDataURL(), x: M.left - cw / 2, y: M.top - ch / 2, width: w + cw, height: h + ch,
      preserveAspectRatio: 'none', 'clip-path': `url(#${id})`,
    }, svg);

    for (const t of niceTicks(0, opts.years, 5)) {
      if (t > opts.years) continue;
      el('line', { x1: M.left, x2: M.left + w, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid-over' }, svg);
      const lab = el('text', { x: M.left - 8, y: y(t), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
      lab.textContent = t === 0 ? 'Now' : t + 'y';
    }
    xAxis(svg, opts, x, width, height, h);

    for (const l of opts.hLines || []) {
      if (l.y > opts.years) continue;
      el('line', { x1: M.left, x2: M.left + w, y1: y(l.y), y2: y(l.y), class: 'h-line' }, svg);
      if (l.label) {
        const lab = el('text', { x: M.left + w - 6, y: y(l.y) - 5, class: 'heat-label', 'text-anchor': 'end' }, svg);
        lab.textContent = l.label;
      }
    }

    const curve = linePath(xs, opts.curve, x, y);
    el('path', { d: curve, class: 'curve-halo' }, svg);
    el('path', { d: curve, class: 'line s-payoff' }, svg);

    for (const m of opts.markers || []) {
      if (m.x < xMin || m.x > xMax) continue;
      el('line', { x1: x(m.x), x2: x(m.x), y1: M.top, y2: M.top + h, class: 'marker' }, svg);
      const flip = x(m.x) > M.left + w * 0.75;
      const lab = el('text', { x: x(m.x) + (flip ? -6 : 6), y: M.top + h - 8, class: 'heat-label', 'text-anchor': flip ? 'end' : 'start' }, svg);
      lab.textContent = m.label;
    }

    // Hover / tap: snap to the nearest column and month.
    const crossX = el('line', { y1: M.top, y2: M.top + h, class: 'crosshair', visibility: 'hidden' }, svg);
    const crossY = el('line', { x1: M.left, x2: M.left + w, class: 'crosshair', visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 5, class: 'dot heat-dot', visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    container.appendChild(tip);

    let cur = null;
    function show(c, m) {
      cur = { c, m };
      const px = x(xs[c]), py = y(m / 12);
      crossX.setAttribute('x1', px); crossX.setAttribute('x2', px);
      crossY.setAttribute('y1', py); crossY.setAttribute('y2', py);
      dot.setAttribute('cx', px); dot.setAttribute('cy', py);
      dot.style.fill = rgb(opts.grid[c][m]);
      for (const n of [crossX, crossY, dot]) n.setAttribute('visibility', 'visible');
      fillTooltip(tip, opts.tooltip(c, m, rgb(opts.grid[c][m])));
      if (width < 520) {
        // Narrow screens: keep the tooltip clear of the finger, in the other half of the chart.
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.max(0, Math.min(px - tw / 2, width - tw)) + 'px';
        tip.style.top = (py > M.top + h / 2 ? M.top : M.top + h - th) + 'px';
      } else {
        placeTooltip(tip, px, Math.max(0, Math.min(py - 40, height - tip.offsetHeight)), width);
      }
    }
    function hide() {
      cur = null;
      for (const n of [crossX, crossY, dot]) n.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    }
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const colAt = (px) => clamp(Math.round(((px - M.left) / w) * (cols - 1)), 0, cols - 1);
    const monthAt = (py) => clamp(Math.round(((M.top + h - py) / h) * months), 0, months);

    const hit = el('rect', { x: M.left, y: M.top, width: w, height: h, class: 'hit', tabindex: 0 }, svg);
    let pointerFocus = false;
    const showAt = (e) => {
      const r = svg.getBoundingClientRect();
      show(colAt(((e.clientX - r.left) / r.width) * width), monthAt(((e.clientY - r.top) / r.height) * height));
    };
    // A tap focuses the chart too; show where it landed, not the keyboard start point.
    hit.addEventListener('pointerdown', (e) => { pointerFocus = true; showAt(e); });
    hit.addEventListener('pointermove', showAt);
    hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
    hit.addEventListener('blur', hide);
    hit.addEventListener('focus', () => {
      if (pointerFocus) { pointerFocus = false; return; }
      const f = opts.focus || { x: xMin, month: 0 };
      show(colAt(x(f.x)), clamp(f.month, 0, months));
    });
    hit.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
      if (!step) return;
      e.preventDefault();
      const base = cur || { c: 0, m: 0 };
      show(clamp(base.c + step[0], 0, cols - 1), clamp(base.m + step[1], 0, months));
    });
  }

  root.LineChart = { render, renderHeatmap, compactGBP, divergingColor, heatColors };
})(window);
