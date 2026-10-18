const test = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, monthlyPayment, simulate, breakEvenPrices } = require('../src/model.js');

const params = (over) => Object.assign({}, DEFAULTS, over);

test('monthly payment matches the standard annuity formula', () => {
  assert.strictEqual(Math.round(monthlyPayment(270000, 4.5, 25)), 1501);
  assert.strictEqual(monthlyPayment(120000, 0, 10), 1000);
});

test('selling immediately loses exactly the buying and selling costs', () => {
  const s = simulate(params({ buyingCosts: 8000, sellingCosts: 5000 }), 5);
  assert.strictEqual(s.rows[0].payoff, -13000);
});

test('running costs are a fixed yearly amount, whatever the price', () => {
  const cheap = simulate(params({ price: 250000, runningCosts: 3000, leaseCosts: 0 }), 1);
  const dear = simulate(params({ price: 600000, runningCosts: 3000, leaseCosts: 0 }), 1);
  assert.strictEqual(cheap.running, 250);
  assert.strictEqual(dear.running, 250);
});

test('service charge and ground rent add to the monthly cost of owning', () => {
  const base = simulate(params({ leaseCosts: 0 }), 1);
  const lease = simulate(params({ leaseCosts: 2700 }), 1);
  assert.strictEqual(lease.leasehold, 225);
  assert.ok(Math.abs(lease.running - base.running - 225) < 1e-9);
  assert.ok(lease.rows[12].payoff < base.rows[12].payoff);
});

test('running and lease costs rise once a year at their own rate', () => {
  const s = simulate(params({ runningCosts: 2400, leaseCosts: 1200, costGrowth: 10, rentGrowth: 0, mortgageRate: 0, deposit: 400000, price: 400000 }), 3);
  const yearCost = (y) => s.rows[y * 12].owningPaid - s.rows[(y - 1) * 12].owningPaid;
  assert.ok(Math.abs(yearCost(1) - 3600) < 1e-6);
  assert.ok(Math.abs(yearCost(2) - 3960) < 1e-6);
  assert.ok(Math.abs(yearCost(3) - 4356) < 1e-6);
  const flat = simulate(params({ costGrowth: 0 }), 5).rows[60].payoff;
  const rising = simulate(params({ costGrowth: 4 }), 5).rows[60].payoff;
  assert.ok(rising < flat);
});

test('monthly savings change both net worths equally, not the payoff', () => {
  const a = simulate(params({ monthlySaving: 0 }), 5).rows[60];
  const b = simulate(params({ monthlySaving: 1000 }), 5).rows[60];
  assert.ok(b.rentNet - a.rentNet > 60000);
  assert.ok(Math.abs((b.buyNet - a.buyNet) - (b.rentNet - a.rentNet)) < 1e-6);
  assert.ok(Math.abs(b.payoff - a.payoff) < 1e-6);
});

test('buyer saves rent minus cost of owning plus savings', () => {
  const s = simulate(params({ rent: 2000, monthlySaving: 1000 }), 1);
  assert.ok(Math.abs(s.buyerSaving - (3000 - s.payment - s.running)) < 1e-9);
});

test('mortgage payments split into interest and principal', () => {
  const s = simulate(params({ price: 400000, deposit: 100000, mortgageRate: 5.1 }), 5);
  const first = s.rows[1];
  assert.ok(Math.abs(first.interestPaid - 300000 * 0.051 / 12) < 1e-6);
  for (const r of s.rows) assert.ok(Math.abs(r.mortgagePaid - r.interestPaid - (s.loan - r.balance)) < 1e-6);
});

test('mortgage is paid off at the end of the term', () => {
  const s = simulate(params({ mortgageTerm: 25 }), 30);
  assert.ok(s.rows[25 * 12].balance < 1e-6);
  assert.strictEqual(s.rows[30 * 12].balance, 0);
});

test('with no growth, no interest and equal monthly costs, buying never wins back the fees', () => {
  const s = simulate(params({ houseGrowth: 0, investReturn: 0, mortgageRate: 0, price: 300000, deposit: 300000, runningCosts: 0, rent: 0 }), 10);
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
