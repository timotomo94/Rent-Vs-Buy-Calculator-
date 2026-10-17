const test = require('node:test');
const assert = require('node:assert');
const { monthlyPayment, simulate } = require('../src/model.js');

test('monthly payment matches the standard annuity formula', () => {
  assert.strictEqual(Math.round(monthlyPayment(270000, 4.5, 25)), 1501);
  assert.strictEqual(monthlyPayment(120000, 0, 10), 1000);
});

test('selling immediately loses exactly the buying and selling costs', () => {
  const s = simulate({ buyingCosts: 8000, sellingCosts: 5000 });
  assert.strictEqual(s.rows[0].payoff, -13000);
});

test('mortgage is paid off at the end of the term', () => {
  const s = simulate({ mortgageTerm: 25, horizon: 30 });
  assert.ok(s.rows[25 * 12].balance < 1e-6);
  assert.strictEqual(s.rows[30 * 12].balance, 0);
});

test('with no growth, no interest and equal monthly costs, buying never wins back the fees', () => {
  const s = simulate({ houseGrowth: 0, investReturn: 0, mortgageRate: 0, price: 300000, depositPct: 100, ownershipCosts: 0, rent: 0, horizon: 10 });
  for (const r of s.rows) assert.strictEqual(Math.round(r.payoff), -13000);
  assert.strictEqual(s.breakevenMonth, null);
});

test('break-even is the first month buying stays ahead', () => {
  const s = simulate({});
  const i = s.breakevenMonth;
  assert.ok(i > 0);
  assert.ok(s.rows[i - 1].payoff < 0);
  assert.ok(s.rows.slice(i).every((r) => r.payoff >= 0));
});
