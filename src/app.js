(function () {
  'use strict';

  const { DEFAULTS, simulate, breakEvenPrices } = window.RentVsBuy;
  const { render, renderHeatmap, divergingColor, heatColors } = window.LineChart;
  const HEAT_SCALE = 50000; // £ at which the heatmap colours are at their strongest
  const BAND = 2; // ± percentage points of house price growth for the "what if" band

  const gbp = (v) => (v < 0 ? '−' : '') + '£' + Math.round(Math.abs(v)).toLocaleString('en-GB');
  const signed = (v) => (v >= 0 ? '+' : '') + gbp(v);
  const kGBP = (v) => '£' + Math.round(v / 1000) + 'k';
  const years = (n) => n + (n === 1 ? ' year' : ' years');

  function duration(months) {
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(years(y));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(' ') || 'straight away';
  }

  // Colour key for the break-even map: renting ahead ← even → buying ahead.
  function renderLegend(container) {
    const colors = heatColors();
    const stops = [];
    for (let i = 0; i <= 20; i++) {
      const v = HEAT_SCALE * (i / 10 - 1);
      stops.push(`rgb(${divergingColor(v, HEAT_SCALE, colors).join(',')}) ${i * 5}%`);
    }
    container.textContent = '';
    const bar = document.createElement('div');
    bar.className = 'heat-bar';
    bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
    const labels = document.createElement('div');
    labels.className = 'heat-labels';
    for (const text of [`Renting ahead ${kGBP(HEAT_SCALE)}+`, 'Even', `Buying ahead ${kGBP(HEAT_SCALE)}+`]) {
      const span = document.createElement('span');
      span.textContent = text;
      labels.appendChild(span);
    }
    container.append(bar, labels);
  }

  const form = document.getElementById('inputs');
  // form.elements includes the sliders that live outside the form (form="inputs").
  const fields = Array.from(form.elements).filter((el) => el.tagName === 'INPUT' && el.name);
  const field = (name) => form.elements[name];
  const SLIDERS = { deposit: ['depositMin', 'depositMax'] };

  function num(name) {
    const v = parseFloat(field(name).value);
    return Number.isFinite(v) ? v : DEFAULTS[name];
  }

  function applySliderBounds() {
    for (const s in SLIDERS) {
      const lo = num(SLIDERS[s][0]), hi = num(SLIDERS[s][1]);
      field(s).min = Math.min(lo, hi);
      field(s).max = Math.max(lo, hi);
    }
  }

  function readInputs() {
    applySliderBounds();
    const p = {};
    for (const f of fields) p[f.name] = num(f.name);
    for (const s in SLIDERS) {
      const [a, b] = SLIDERS[s];
      if (p[a] > p[b]) [p[a], p[b]] = [p[b], p[a]];
    }
    p.stayMin = Math.max(1, Math.round(p.stayMin));
    p.stayMax = Math.max(p.stayMin, Math.round(p.stayMax));
    p.chartYears = Math.min(40, Math.max(p.stayMax, Math.round(p.chartYears)));
    return p;
  }

  function writeInputs(p) {
    for (const f of fields) if (!(f.name in SLIDERS)) f.value = p[f.name];
    applySliderBounds();
    for (const s in SLIDERS) field(s).value = p[s];
  }

  function fromURL() {
    const q = new URLSearchParams(location.search);
    const p = Object.assign({}, DEFAULTS);
    for (const k in DEFAULTS) if (q.has(k) && Number.isFinite(parseFloat(q.get(k)))) p[k] = parseFloat(q.get(k));
    return p;
  }

  function toURL(p) {
    const q = new URLSearchParams();
    for (const k in DEFAULTS) if (p[k] !== DEFAULTS[k]) q.set(k, p[k]);
    const s = q.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }

  function update() {
    const p = readInputs();
    toURL(p);
    const stays = [];
    for (let s = p.stayMin; s <= p.stayMax; s++) stays.push(s);
    const withPrice = (price, deposit) => Object.assign({}, p, { price, deposit: deposit == null ? p.deposit : deposit });
    const ltv = (Math.max(0, p.price - p.deposit) / p.price) * 100;

    // Inputs readouts
    document.getElementById('out-deposit').textContent = `${gbp(Math.min(p.deposit, p.price))} (${Math.round(100 - ltv)}%)`;
    document.getElementById('out-lease').textContent = gbp(p.leaseCosts) + ' / yr';
    document.getElementById('out-rate').textContent = p.mortgageRate.toFixed(2) + '%';

    // Verdict for the chosen home
    const base = simulate(p, p.chartYears);
    const atStay = base.rows[p.stayMax * 12];
    const be = base.breakevenMonth;
    document.getElementById('verdict').textContent = be === null
      ? `Renting wins for at least ${years(p.chartYears)}`
      : `Buying breaks even after ${duration(be)}`;
    document.getElementById('verdict-detail').textContent =
      `For a ${gbp(p.price)} home with a ${gbp(p.deposit)} deposit. If you sell after ${years(p.stayMax)}, ` +
      (atStay.payoff >= 0 ? `buying leaves you ${gbp(atStay.payoff)} better off.` : `renting leaves you ${gbp(-atStay.payoff)} better off.`);

    const owning = base.payment + base.running;
    document.getElementById('stat-owning').textContent = gbp(owning) + ' / month';
    document.getElementById('stat-owning-split').textContent = `mortgage ${gbp(base.payment)} + upkeep ${gbp(base.running - base.leasehold)}` +
      (base.leasehold ? ` + service & ground rent ${gbp(base.leasehold)}` : '');
    document.getElementById('stat-rent').textContent = gbp(p.rent) + ' / month';
    document.getElementById('stat-saving-buy').textContent = gbp(base.buyerSaving) + ' / month';
    document.getElementById('stat-saving-split').textContent = base.buyerSaving < 0
      ? 'owning costs more than rent + savings'
      : 'rent − owning + savings';
    document.getElementById('stat-saving-rent').textContent = gbp(p.monthlySaving) + ' / month';
    document.getElementById('stat-ltv').textContent = Math.round(ltv) + '%';
    document.getElementById('stat-cash').textContent = gbp(base.deposit + p.buyingCosts);

    // Break-even map: how far ahead buying is, for every price and month you might sell
    const prices = [];
    for (let x = p.priceMin; x < p.priceMax; x += 5000) prices.push(x);
    prices.push(p.priceMax);
    const sims = prices.map((price) => simulate(withPrice(price), p.chartYears));
    const grid = sims.map((s) => s.rows.map((r) => r.payoff));
    const curve = sims.map((s) => (s.breakevenMonth === null ? null : s.breakevenMonth / 12));

    document.getElementById('breakeven-sub').textContent =
      `How far ahead buying leaves you, by price and when you sell (${kGBP(p.deposit)} deposit). ` +
      'The line is break-even. Tap anywhere for the amount.';
    renderLegend(document.getElementById('heat-legend'));

    const tickStep = p.priceMax - p.priceMin > 400000 ? 100000 : 50000;
    const xTicks = [];
    for (let t = Math.ceil(p.priceMin / tickStep) * tickStep; t <= p.priceMax; t += tickStep) xTicks.push(t);
    const hLines = p.stayMin === p.stayMax
      ? [{ y: p.stayMax, label: `Your stay: ${years(p.stayMax)}` }]
      : [{ y: p.stayMin }, { y: p.stayMax, label: `Your stay: ${p.stayMin}–${p.stayMax} years` }];
    renderHeatmap(document.getElementById('breakeven-chart'), {
      xs: prices,
      months: p.chartYears * 12,
      years: p.chartYears,
      grid,
      scale: HEAT_SCALE,
      curve,
      xTicks,
      xFormat: kGBP,
      xTitle: 'House price',
      hLines,
      markers: [{ x: p.price, label: 'Your home' }],
      focus: { x: p.price, month: p.stayMax * 12 },
      ariaLabel: 'How much better off buying leaves you by house price and years until you sell, with the break-even line',
      tooltip: (c, m, color) => {
        const v = grid[c][m];
        return {
          title: `${gbp(prices[c])} home, sell ${m === 0 ? 'immediately' : 'after ' + duration(m)}`,
          rows: [
            { label: v >= 0 ? 'buying ahead' : 'renting ahead', value: gbp(Math.abs(v)), cls: 'swatch', color },
            { label: 'break-even', value: curve[c] == null ? `over ${years(p.chartYears)}` : duration(Math.round(curve[c] * 12)), cls: 's-payoff' },
          ],
        };
      },
    });

    // Most you should pay
    document.getElementById('max-sub').textContent =
      `Highest price between ${gbp(p.priceMin)} and ${gbp(p.priceMax)} where buying beats renting, with a ${gbp(p.deposit)} deposit.`;
    const tbodyMax = document.querySelector('#max-table tbody');
    tbodyMax.textContent = '';
    for (const r of breakEvenPrices((price) => withPrice(price), stays, p.priceMin, p.priceMax, 1000)) {
      const tr = document.createElement('tr');
      const a = document.createElement('td');
      a.textContent = years(r.years);
      const b = document.createElement('td');
      b.textContent = r.price === null ? 'Renting wins at every price'
        : r.all ? `Every price up to ${gbp(p.priceMax)}`
        : gbp(r.price);
      tr.append(a, b);
      tbodyMax.appendChild(tr);
    }

    // Month by month for the chosen home, long enough to show the break-even
    const span = Math.min(p.chartYears, Math.max(p.stayMax, be === null ? 0 : Math.ceil(be / 12) + 1));
    const rows = base.rows.slice(0, span * 12 + 1);
    const low = simulate(Object.assign({}, p, { houseGrowth: p.houseGrowth - BAND }), span).rows;
    const high = simulate(Object.assign({}, p, { houseGrowth: p.houseGrowth + BAND }), span).rows;
    document.getElementById('time-sub').textContent =
      `${gbp(p.price)} home, ${gbp(p.deposit)} deposit. The grey band shows house prices growing ${BAND} points a year faster or slower than ${p.houseGrowth}%.`;
    const yearTicks = [];
    for (let t = 0; t <= span; t++) yearTicks.push(t);
    const timeMarkers = [{ x: p.stayMax, label: `End of your stay: ${years(p.stayMax)}`, cls: 'stay' }];
    if (be) timeMarkers.push({ x: be / 12, label: 'Break-even', cls: 'even', row: 1 });
    render(document.getElementById('time-chart'), {
      xs: rows.map((r) => r.year),
      xTicks: yearTicks,
      xFormat: (t) => (t === 0 ? 'Now' : t + 'y'),
      xTitle: 'Time until you sell',
      series: [{ label: 'Buying advantage', values: rows.map((r) => r.payoff), cls: 's-payoff' }],
      band: { lo: low.map((r) => r.payoff), hi: high.map((r) => r.payoff) },
      polarity: true,
      markers: timeMarkers,
      focusX: p.stayMax,
      ariaLabel: 'Buying advantage over renting for your home, by month you sell',
      tooltip: (i) => {
        const r = rows[i];
        return {
          title: i === 0 ? 'Sell immediately' : 'Sell after ' + duration(i),
          rows: [
            { label: r.payoff >= 0 ? 'buying ahead' : 'renting ahead', value: gbp(Math.abs(r.payoff)), cls: 's-payoff' },
            { label: `prices ${p.houseGrowth + BAND}%/yr`, value: signed(high[i].payoff), cls: 'band-key' },
            { label: `prices ${p.houseGrowth - BAND}%/yr`, value: signed(low[i].payoff), cls: 'band-key' },
          ],
        };
      },
    });

    // Year table
    const tbody = document.querySelector('#year-table tbody');
    tbody.textContent = '';
    for (let y = 0; y <= span; y++) {
      const r = rows[y * 12];
      const tr = document.createElement('tr');
      for (const v of [y, gbp(r.rentPaid), gbp(r.owningPaid), gbp(r.balance), gbp(r.buyNet), gbp(r.rentNet), signed(r.payoff)]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    // Mortgage repayments and equity, year by year over the same years as the map
    const er = base.rows;
    const growth = er[p.stayMax * 12].homeValue - p.price;
    const atEnd = er[p.stayMax * 12];
    document.getElementById('equity-sub').textContent =
      `${gbp(p.price)} home, ${gbp(base.deposit)} deposit, ${gbp(base.loan)} mortgage at ${p.mortgageRate.toFixed(2)}% over ${years(p.mortgageTerm)} ` +
      `(${gbp(base.payment)} a month). Equity is the home's value minus the mortgage left, before selling costs. Shaded rows are your stay.`;
    document.getElementById('equity-summary').textContent =
      `After ${years(p.stayMax)}: ${gbp(atEnd.homeValue - atEnd.balance)} equity = ${gbp(base.deposit)} deposit + ` +
      `${gbp(base.loan - atEnd.balance)} loan repaid` + (growth ? ` ${growth > 0 ? '+' : '−'} ${gbp(Math.abs(growth))} price change` : '') +
      `. You'd have paid ${gbp(atEnd.mortgagePaid)} to the lender, ${gbp(atEnd.interestPaid)} of it interest.`;
    const etbody = document.querySelector('#equity-table tbody');
    etbody.textContent = '';
    for (let y = 1; y <= p.chartYears; y++) {
      const r = er[y * 12], prev = er[(y - 1) * 12];
      const paid = r.mortgagePaid - prev.mortgagePaid;
      const interest = r.interestPaid - prev.interestPaid;
      const equity = r.homeValue - r.balance;
      const tr = document.createElement('tr');
      if (y >= p.stayMin && y <= p.stayMax) tr.className = 'in-stay';
      for (const v of [y, gbp(equity), Math.round((100 * equity) / r.homeValue) + '%', gbp(paid - interest), gbp(interest), gbp(r.balance), gbp(paid)]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      etbody.appendChild(tr);
    }
  }

  writeInputs(fromURL());
  document.addEventListener('input', (e) => { if (e.target.form === form) update(); });
  document.getElementById('reset').addEventListener('click', () => { writeInputs(DEFAULTS); update(); });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(update, 100); });
  // The heatmap colours come from CSS, so redraw when the colour scheme flips.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
  update();
})();
