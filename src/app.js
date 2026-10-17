(function () {
  'use strict';

  const { DEFAULTS, simulate } = window.RentVsBuy;
  const { render } = window.LineChart;
  const BAND = 2; // ± percentage points of house price growth for the "what if" band

  const gbp = (v) => (v < 0 ? '−' : '') + '£' + Math.round(Math.abs(v)).toLocaleString('en-GB');
  const signed = (v) => (v >= 0 ? '+' : '') + gbp(v);

  function duration(months) {
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(' ') || 'straight away';
  }

  const form = document.getElementById('inputs');
  const fields = Array.from(form.querySelectorAll('input[name]'));

  function readInputs() {
    const p = {};
    for (const f of fields) {
      const v = parseFloat(f.value);
      p[f.name] = Number.isFinite(v) ? v : DEFAULTS[f.name];
    }
    p.horizon = Math.min(50, Math.max(1, Math.round(p.horizon)));
    p.plannedStay = Math.min(p.horizon, Math.max(0, p.plannedStay));
    return p;
  }

  function writeInputs(p) {
    for (const f of fields) f.value = p[f.name];
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
    const base = simulate(p);
    const low = simulate(Object.assign({}, p, { houseGrowth: p.houseGrowth - BAND }));
    const high = simulate(Object.assign({}, p, { houseGrowth: p.houseGrowth + BAND }));
    const rows = base.rows;
    const xs = rows.map((r) => r.year);
    const at = (year) => rows[Math.round(year * 12)];
    const stay = at(p.plannedStay);

    // Headline
    const be = base.breakevenMonth;
    const verdict = document.getElementById('verdict');
    const detail = document.getElementById('verdict-detail');
    if (be === null) {
      verdict.textContent = `Renting stays ahead for all ${p.horizon} years`;
    } else if (be === 0) {
      verdict.textContent = 'Buying is ahead from day one';
    } else {
      verdict.textContent = `Buying pays off after ${duration(be)}`;
    }
    const lead = stay.payoff >= 0 ? 'buying leaves you' : 'renting leaves you';
    detail.textContent = `If you sell after ${p.plannedStay} years, ${lead} ${gbp(Math.abs(stay.payoff))} better off.`;

    const beLow = low.breakevenMonth, beHigh = high.breakevenMonth;
    const fmt = (m) => (m === null ? `never (within ${p.horizon} years)` : duration(m));
    document.getElementById('verdict-range').textContent =
      `If house prices grow ${BAND} points a year faster, the break-even is ${fmt(beHigh)}; ${BAND} points slower, ${fmt(beLow)}.`;

    document.getElementById('stat-payment').textContent = gbp(base.payment);
    document.getElementById('stat-cash').textContent = gbp(base.deposit + p.buyingCosts);
    document.getElementById('stat-hole').textContent = gbp(p.buyingCosts + p.sellingCosts);

    // Payoff chart
    const markers = [{ x: p.plannedStay, label: `Your stay: ${p.plannedStay}y`, cls: 'stay' }];
    if (be) markers.push({ x: be / 12, label: 'Break-even', cls: 'even', row: 1 });
    render(document.getElementById('payoff-chart'), {
      xs,
      series: [{ label: 'Buying advantage', values: rows.map((r) => r.payoff), cls: 's-payoff' }],
      band: { lo: low.rows.map((r) => r.payoff), hi: high.rows.map((r) => r.payoff) },
      polarity: true,
      markers,
      focusYear: p.plannedStay,
      ariaLabel: 'Buying advantage over renting by the year you sell',
      tooltip: (year) => {
        const i = Math.round(year * 12);
        const r = rows[i];
        return {
          title: year === 0 ? 'Sell immediately' : `Sell after ${year} ${year === 1 ? 'year' : 'years'}`,
          rows: [
            { label: r.payoff >= 0 ? 'buying ahead' : 'renting ahead', value: gbp(Math.abs(r.payoff)), cls: 's-payoff' },
            { label: `prices +${BAND} pts/yr`, value: signed(high.rows[i].payoff), cls: 'band-key' },
            { label: `prices −${BAND} pts/yr`, value: signed(low.rows[i].payoff), cls: 'band-key' },
          ],
        };
      },
    });

    // Net worth chart
    render(document.getElementById('worth-chart'), {
      xs,
      series: [
        { label: 'Buying', values: rows.map((r) => r.buyNet), cls: 's-buy' },
        { label: 'Renting', values: rows.map((r) => r.rentNet), cls: 's-rent' },
      ],
      markers: [{ x: p.plannedStay, label: `Your stay: ${p.plannedStay}y`, cls: 'stay' }],
      focusYear: p.plannedStay,
      ariaLabel: 'Net worth when buying and when renting, by the year you sell',
      tooltip: (year) => {
        const r = at(year);
        return {
          title: year === 0 ? 'Now' : `After ${year} ${year === 1 ? 'year' : 'years'}`,
          rows: [
            { label: 'buying', value: gbp(r.buyNet), cls: 's-buy' },
            { label: 'renting', value: gbp(r.rentNet), cls: 's-rent' },
          ],
        };
      },
    });

    // Table
    const tbody = document.querySelector('#year-table tbody');
    tbody.textContent = '';
    for (let year = 0; year <= p.horizon; year++) {
      const r = at(year);
      const tr = document.createElement('tr');
      if (year === Math.round(p.plannedStay)) tr.className = 'hl';
      for (const v of [year, gbp(r.homeValue), gbp(r.balance), gbp(r.buyNet), gbp(r.rentNet), signed(r.payoff)]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  writeInputs(fromURL());
  form.addEventListener('input', update);
  document.getElementById('reset').addEventListener('click', () => { writeInputs(DEFAULTS); update(); });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(update, 100); });
  update();
})();
