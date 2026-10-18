// Rent vs buy model.
//
// Both scenarios start with the same cash (deposit + buying costs) and spend the
// same amount every month. The renter invests the cash the buyer would have put
// into the house; whoever has the cheaper month invests the difference. Net worth
// is what you'd walk away with if you sold / stopped at that point.
(function (root) {
  'use strict';

  const DEFAULTS = {
    price: 400000,        // £ purchase price (the one you're looking at)
    priceMin: 250000,     // £ range of prices you're considering
    priceMax: 600000,
    deposit: 100000,      // £
    depositMin: 60000,    // £ range of deposits you could put down
    depositMax: 135000,
    mortgageRate: 5.1,    // % per year
    mortgageTerm: 35,     // years
    runningCostPct: 1,    // % of price per year: maintenance, insurance, service charge
    rent: 2025,           // £ per month
    rentGrowth: 4,        // % per year, applied once a year
    investReturn: 7,      // % per year, compounded monthly
    houseGrowth: 0,       // % per year
    buyingCosts: 8000,    // £ one-off: stamp duty, legal, survey, mortgage fees
    sellingCosts: 5000,   // £ one-off when you sell: agent, legal
    stay: 3,              // years you expect to stay
    stayMin: 1,           // years: range of stays you're considering
    stayMax: 5,
    chartYears: 15,       // years shown on the break-even chart
  };

  function monthlyPayment(principal, annualRatePct, years) {
    const n = Math.round(years * 12);
    if (principal <= 0 || n <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  // Returns one row per month from 0 to `years` * 12.
  function simulate(p, years) {
    const months = Math.round(years * 12);
    const deposit = Math.min(p.deposit, p.price);
    const loan = p.price - deposit;
    const termMonths = Math.round(p.mortgageTerm * 12);
    const payment = monthlyPayment(loan, p.mortgageRate, p.mortgageTerm);
    const running = (p.price * p.runningCostPct) / 100 / 12;
    const mRate = p.mortgageRate / 100 / 12;
    const iRate = Math.pow(1 + p.investReturn / 100, 1 / 12) - 1;

    let balance = loan;
    let buyerPot = 0;
    let renterPot = deposit + p.buyingCosts;
    let rentPaid = 0;
    let owningPaid = 0;

    const rows = [];
    const snapshot = (m) => {
      const homeValue = p.price * Math.pow(1 + p.houseGrowth / 100, m / 12);
      const buyNet = homeValue - balance - p.sellingCosts + buyerPot;
      rows.push({
        month: m,
        year: m / 12,
        homeValue,
        balance,
        buyerPot,
        renterPot,
        buyNet,
        rentNet: renterPot,
        payoff: buyNet - renterPot,
        rentPaid,
        owningPaid,
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
        // The last payment clears whatever rounding has left over.
        mortgageOut = m === termMonths - 1 ? balance + interest : Math.min(payment, balance + interest);
        balance = Math.max(0, balance + interest - mortgageOut);
      }
      const owningOut = mortgageOut + running;
      const rentOut = p.rent * Math.pow(1 + p.rentGrowth / 100, Math.floor(m / 12));

      const diff = owningOut - rentOut;
      if (diff > 0) renterPot += diff;
      else buyerPot -= diff;

      owningPaid += owningOut;
      rentPaid += rentOut;
      snapshot(m + 1);
    }

    return { deposit, loan, payment, running, rows, breakevenMonth: breakeven(rows) };
  }

  // First month from which buying stays ahead for the rest of the rows,
  // or null if buying is behind at the end.
  function breakeven(rows) {
    if (rows[rows.length - 1].payoff < 0) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].payoff < 0) return rows[i + 1].month;
    }
    return 0;
  }

  // For each stay in `stays` (whole years), the highest price in [priceMin, priceMax]
  // at which buying beats renting: [{ years, price, all }], where all = true if every
  // price wins and price = null if none does. `withPrice(price)` returns full params.
  function breakEvenPrices(withPrice, stays, priceMin, priceMax, step) {
    step = step || 1000;
    const out = stays.map((years) => ({ years, price: null, all: true }));
    const longest = Math.max.apply(null, stays);
    for (let price = priceMin; price <= priceMax; price += step) {
      const rows = simulate(withPrice(price), longest).rows;
      for (const r of out) {
        if (rows[r.years * 12].payoff >= 0) r.price = price;
        else r.all = false;
      }
    }
    return out;
  }

  const api = { DEFAULTS, monthlyPayment, simulate, breakEvenPrices };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RentVsBuy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
