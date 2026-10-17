const test = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, monthlyPayment, rateForLtv, simulate, breakEvenPrices } = require('../src/model.js');
const RATES = require('../data/rates.js');

const params = (over) => Object.assign({}, DEFAULTS, { mortgageRate: 5 }, over);

test('monthly payment matches the standard annuity formula', () => {
  assert.strictEqual(Math.round(monthlyPayment(270000, 4.5, 25)), 1501);
  assert.strictEqual(monthlyPayment(120000, 0, 10), 1000);
});

test('rate lookup picks the first loan-to-value band that covers the loan', () => {
  const bands = [{ maxLtv: 60, rate: 4 }, { maxLtv: 75, rate: 4.5 }, { maxLtv: 95, rate: 5.5 }];
  assert.strictEqual(rateForLtv(40, bands), 4);
  assert.strictEqual(rateForLtv(60, bands), 4);
  assert.strictEqual(rateForLtv(60.1, bands), 4.5);
  assert.strictEqual(rateForLtv(99, bands), 5.5);
});

test('the rates snapshot has a sorted set of bands', () => {
  assert.match(RATES.month, /^\d{4}-\d{2}$/);
  const ltvs = RATES.bands.map((b) => b.maxLtv);
  assert.deepStrictEqual(ltvs, ltvs.slice().sort((a, b) => a - b));
  for (const b of RATES.bands) assert.ok(b.rate > 0 && b.rate < 20);
});

test('selling immediately loses exactly the buying and selling costs', () => {
  const s = simulate(params({ buyingCosts: 8000, sellingCosts: 5000 }), 5);
  assert.strictEqual(s.rows[0].payoff, -13000);
});

test('running costs are a percentage of the price', () => {
  const s = simulate(params({ price: 400000, runningCostPct: 1 }), 1);
  assert.strictEqual(s.running, 4000 / 12);
});

test('mortgage is paid off at the end of the term', () => {
  const s = simulate(params({ mortgageTerm: 25 }), 30);
  assert.ok(s.rows[25 * 12].balance < 1e-6);
  assert.strictEqual(s.rows[30 * 12].balance, 0);
});

test('with no growth, no interest and equal monthly costs, buying never wins back the fees', () => {
  const s = simulate(params({ houseGrowth: 0, investReturn: 0, mortgageRate: 0, price: 300000, deposit: 300000, runningCostPct: 0, rent: 0 }), 10);
  for (const r of s.rows) assert.strictEqual(Math.round(r.payoff), -13000);
  assert.strictEqual(s.breakevenMonth, null);
});

test('break-even is the first month buying stays ahead', () => {
  const s = simulate(params({ price: 250000 }), 5);
  const i = s.breakevenMonth;
  assert.ok(i > 0);
  assert.ok(s.rows[i - 1].payoff < 0);
  assert.ok(s.rows.slice(i).every((r) => r.payoff >= 0));
});

test('break-even price is where buying stops winning', () => {
  const withPrice = (price) => params({ price });
  const [r] = breakEvenPrices(withPrice, [5], 250000, 600000, 1000);
  assert.ok(r.price > 250000 && r.price < 600000);
  assert.ok(simulate(withPrice(r.price), 5).rows[60].payoff >= 0);
  assert.ok(simulate(withPrice(r.price + 1000), 5).rows[60].payoff < 0);
});
