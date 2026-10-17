(function () {
  'use strict';

  const { DEFAULTS, rateForLtv, simulate, breakEvenPrices } = window.RentVsBuy;
  const RATES = window.MORTGAGE_RATES;
  const { render } = window.LineChart;
  const BAND = 2; // ± percentage points of house price growth for the "what if" band
  const STAY_CLASSES = 5; // .s-stay1 … .s-stay5, light to dark

  const gbp = (v) => (v < 0 ? '−' : '') + '£' + Math.round(Math.abs(v)).toLocaleString('en-GB');
  const signed = (v) => (v >= 0 ? '+' : '') + gbp(v);
  const kGBP = (v) => '£' + Math.round(v / 1000) + 'k';
  const years = (n) => n + (n === 1 ? ' year' : ' years');
  const monthName = (ym) => new Date(ym + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  function duration(months) {
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(years(y));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(' ') || 'straight away';
  }

  const form = document.getElementById('inputs');
  const fields = Array.from(form.querySelectorAll('input[name]'));
  const field = (name) => form.elements[name];
  const SLIDERS = { price: ['priceMin', 'priceMax'], deposit: ['depositMin', 'depositMax'], stay: ['stayMin', 'stayMax'] };

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
    p.mortgageRate = field('mortgageRate').value === '' ? null : num('mortgageRate');
    return p;
  }

  function writeInputs(p) {
    for (const f of fields) if (!(f.name in SLIDERS)) f.value = p[f.name] == null ? '' : p[f.name];
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
    for (const k in DEFAULTS) if (p[k] !== DEFAULTS[k] && p[k] != null) q.set(k, p[k]);
    const s = q.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }

  // Full model params for a given price, filling in the mortgage rate from LTV.
  function paramsFor(p, price) {
    const ltv = (Math.max(0, price - p.deposit) / price) * 100;
    const auto = p.mortgageRate == null;
    return Object.assign({}, p, { price, ltv, autoRate: auto, mortgageRate: auto ? rateForLtv(ltv, RATES.bands) : p.mortgageRate });
  }

  function stayClass(i, count) {
    // Spread the stays across the 5 ramp steps so the longest is always darkest.
    const step = count === 1 ? STAY_CLASSES : Math.round(1 + (i * (STAY_CLASSES - 1)) / (count - 1));
    return 's-stay' + step;
  }

  function update() {
    const p = readInputs();
    toURL(p);
    const stays = [];
    for (let s = p.stayMin; s <= p.stayMax; s++) stays.push(s);
    const stay = Math.round(p.stay);
    const mine = paramsFor(p, p.price);
    const base = simulate(mine, p.stayMax);
    const atStay = base.rows[stay * 12];

    // Inputs readouts
    document.getElementById('out-price').textContent = gbp(p.price);
    document.getElementById('out-deposit').textContent = `${gbp(Math.min(p.deposit, p.price))} (${Math.round(100 - mine.ltv)}%)`;
    document.getElementById('out-stay').textContent = years(stay);
    const ltvBand = RATES.bands.find((b) => mine.ltv <= b.maxLtv);
    document.getElementById('rate-note').textContent = mine.autoRate
      ? `Loan-to-value ${Math.round(mine.ltv)}%, so the mortgage rate is ${mine.mortgageRate}% (${ltvBand ? '≤' + ltvBand.maxLtv + '%' : 'over 95%, no typical deal;'} LTV average, ${monthName(RATES.month)}).`
      : `Loan-to-value ${Math.round(mine.ltv)}%, using your rate of ${mine.mortgageRate}%.`;
    document.getElementById('rate-source').textContent = `${RATES.source}, ${monthName(RATES.month)}`;

    // Verdict
    const verdict = document.getElementById('verdict');
    verdict.textContent = atStay.payoff >= 0
      ? `Buying wins by ${gbp(atStay.payoff)}`
      : `Renting wins by ${gbp(-atStay.payoff)}`;
    const be = base.breakevenMonth;
    document.getElementById('verdict-detail').textContent =
      `For a ${gbp(p.price)} home you sell after ${years(stay)}. ` +
      (be === null ? `Buying doesn't catch up within ${years(p.stayMax)}.`
        : be === 0 ? 'Buying is ahead from day one.'
        : `Buying pulls ahead after ${duration(be)}.`);

    const owning = base.payment + base.running;
    document.getElementById('stat-owning').textContent = gbp(owning) + ' / month';
    document.getElementById('stat-owning-split').textContent = `mortgage ${gbp(base.payment)} + running ${gbp(base.running)}`;
    document.getElementById('stat-rent').textContent = gbp(p.rent) + ' / month';
    document.getElementById('stat-rate').textContent = mine.mortgageRate + '%';
    document.getElementById('stat-ltv').textContent = `${Math.round(mine.ltv)}% loan-to-value`;
    document.getElementById('stat-cash').textContent = gbp(base.deposit + p.buyingCosts);

    // Payoff by price: one line per stay
    const priceStep = 5000;
    const prices = [];
    for (let x = p.priceMin; x < p.priceMax; x += priceStep) prices.push(x);
    prices.push(p.priceMax);
    const sims = prices.map((price) => simulate(paramsFor(p, price), p.stayMax).rows);
    const series = stays.map((s, i) => ({
      label: 'Sell after ' + years(s),
      values: sims.map((rows) => rows[s * 12].payoff),
      cls: stayClass(i, stays.length),
    }));

    document.getElementById('payoff-sub').textContent =
      `How much better off buying leaves you than renting, with a ${gbp(p.deposit)} deposit. ` +
      'Where a line drops below £0 is the most you should pay for that stay.';
    const legend = document.getElementById('payoff-legend');
    legend.textContent = '';
    for (const s of series) {
      const li = document.createElement('li');
      const key = document.createElement('span');
      key.className = 'key ' + s.cls;
      li.append(key, s.label.replace('Sell after ', ''));
      legend.appendChild(li);
    }

    const tickStep = p.priceMax - p.priceMin > 400000 ? 100000 : 50000;
    const xTicks = [];
    for (let t = Math.ceil(p.priceMin / tickStep) * tickStep; t <= p.priceMax; t += tickStep) xTicks.push(t);
    render(document.getElementById('payoff-chart'), {
      xs: prices,
      xTicks,
      xFormat: kGBP,
      xTitle: 'House price',
      series,
      polarity: true,
      markers: [{ x: p.price, label: 'Your home', cls: 'stay' }],
      focusX: p.price,
      ariaLabel: 'Buying advantage over renting by house price, one line per length of stay',
      tooltip: (i) => ({
        title: gbp(prices[i]) + ' home',
        rows: series.slice().reverse().map((s) => ({ label: s.label.replace('Sell after ', 'after '), value: signed(s.values[i]), cls: s.cls })),
      }),
    });

    // Most you should pay
    document.getElementById('max-sub').textContent =
      `Highest price between ${gbp(p.priceMin)} and ${gbp(p.priceMax)} where buying beats renting, with a ${gbp(p.deposit)} deposit.`;
    const tbodyMax = document.querySelector('#max-table tbody');
    tbodyMax.textContent = '';
    for (const r of breakEvenPrices((price) => paramsFor(p, price), stays, p.priceMin, p.priceMax, 1000)) {
      const tr = document.createElement('tr');
      if (r.years === stay) tr.className = 'hl';
      const a = document.createElement('td');
      a.textContent = years(r.years);
      const b = document.createElement('td');
      b.textContent = r.price === null ? 'Renting wins at every price'
        : r.all ? `Every price up to ${gbp(p.priceMax)}`
        : gbp(r.price);
      tr.append(a, b);
      tbodyMax.appendChild(tr);
    }

    // Month by month for the chosen home, with a house price band
    const low = simulate(Object.assign({}, mine, { houseGrowth: p.houseGrowth - BAND }), p.stayMax).rows;
    const high = simulate(Object.assign({}, mine, { houseGrowth: p.houseGrowth + BAND }), p.stayMax).rows;
    const rows = base.rows;
    document.getElementById('time-sub').textContent =
      `${gbp(p.price)} home, ${gbp(p.deposit)} deposit. The grey band shows house prices growing ${BAND} points a year faster or slower than ${p.houseGrowth}%.`;
    const yearTicks = [];
    for (let t = 0; t <= p.stayMax; t++) yearTicks.push(t);
    const timeMarkers = [{ x: stay, label: `Your stay: ${years(stay)}`, cls: 'stay' }];
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
      focusX: stay,
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
    for (let y = 0; y <= p.stayMax; y++) {
      const r = rows[y * 12];
      const tr = document.createElement('tr');
      if (y === stay) tr.className = 'hl';
      for (const v of [y, gbp(r.rentPaid), gbp(r.owningPaid), gbp(r.balance), gbp(r.buyNet), gbp(r.rentNet), signed(r.payoff)]) {
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
