// Rent vs buy model.
//
// Both scenarios start with the same cash (deposit + buying costs) and spend the
// same amount every month. The renter invests the cash the buyer would have put
// into the house; whoever has the cheaper month invests the difference. Net worth
// is what you'd walk away with if you sold / stopped at that point.
(function (root) {
  'use strict';

  const DEFAULTS = {
    price: 300000,        // £ purchase price
    depositPct: 10,       // % of price
    mortgageRate: 4.5,    // % per year
    mortgageTerm: 25,     // years
    houseGrowth: 3,       // % per year
    ownershipCosts: 1500, // £ per year: maintenance, insurance, service charge
    rent: 1300,           // £ per month
    rentGrowth: 3,        // % per year, applied once a year
    investReturn: 5,      // % per year, compounded monthly
    buyingCosts: 8000,    // £ one-off: stamp duty, legal, survey, mortgage fees
    sellingCosts: 5000,   // £ one-off when you sell: agent, legal
    horizon: 15,          // years shown on the chart
    plannedStay: 7,       // years you expect to stay
  };

  function monthlyPayment(principal, annualRatePct, years) {
    const n = Math.round(years * 12);
    if (principal <= 0 || n <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  // Returns one row per month from 0 to horizon * 12.
  function simulate(input) {
    const p = Object.assign({}, DEFAULTS, input);
    const months = Math.round(p.horizon * 12);
    const deposit = (p.price * p.depositPct) / 100;
    const loan = Math.max(0, p.price - deposit);
    const termMonths = Math.round(p.mortgageTerm * 12);
    const payment = monthlyPayment(loan, p.mortgageRate, p.mortgageTerm);
    const mRate = p.mortgageRate / 100 / 12;
    const iRate = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1;

    let balance = loan;
    let buyerPot = 0;
    let renterPot = deposit + p.buyingCosts;
    let rentPaid = 0;
    let mortgagePaid = 0;
    let ownershipPaid = 0;

    const rows = [];
    const snapshot = (m) => {
      const homeValue = p.price * Math.pow(1 + p.houseGrowth / 100, m / 12);
      const buyNet = homeValue - balance - p.sellingCosts + buyerPot;
      const rentNet = renterPot;
      rows.push({
        month: m,
        year: m / 12,
        homeValue,
        balance,
        buyerPot,
        renterPot,
        buyNet,
        rentNet,
        payoff: buyNet - rentNet,
        rentPaid,
        mortgagePaid,
        ownershipPaid,
      });
    };

    snapshot(0);
    for (let m = 0; m < months; m++) {
      // Money already invested grows first; this month's savings go in at month end.
      buyerPot *= 1 + iRate;
      renterPot *= 1 + iRate;

      let mortgageOut = 0;
      if (m < termMonths && balance > 0) {
        const interest = balance * mRate;
        mortgageOut = Math.min(payment, balance + interest);
        balance = Math.max(0, balance + interest - mortgageOut);
      }
      const ownOut = p.ownershipCosts / 12;
      const rentOut = p.rent * Math.pow(1 + p.rentGrowth / 100, Math.floor(m / 12));

      const diff = mortgageOut + ownOut - rentOut;
      if (diff > 0) renterPot += diff;
      else buyerPot -= diff;

      mortgagePaid += mortgageOut;
      ownershipPaid += ownOut;
      rentPaid += rentOut;
      snapshot(m + 1);
    }

    return { params: p, deposit, loan, payment, rows, breakevenMonth: breakeven(rows) };
  }

  // First month from which buying stays ahead for the rest of the horizon,
  // or null if buying is behind at the end.
  function breakeven(rows) {
    if (rows[rows.length - 1].payoff < 0) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].payoff < 0) return rows[i + 1].month;
    }
    return 0;
  }

  const api = { DEFAULTS, monthlyPayment, simulate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RentVsBuy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
