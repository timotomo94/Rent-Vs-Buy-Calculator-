# Rent vs Buy Calculator

A UK rent-vs-buy calculator built around one question: **how long do you need to stay for buying to beat renting?**

Open `index.html` in a browser. There's no build step and no dependencies. Inputs are saved in the URL, so you can share a scenario by copying the link.

## The payoff graph

The main chart puts house price on the x-axis, with one line per length of stay. The y-axis is how much better off buying leaves you than renting when you sell. Where a line drops below £0 is the most you should pay for that stay. The "Most you should pay" table lists those prices.

You set the home you're looking at with three sliders: price, deposit and length of stay. Each slider covers your chosen range (by default £250k–600k, £60k–135k and 1–5 years). A second chart follows that one home month by month, with a band for house prices growing 2 points a year faster or slower.

## The model

- Both scenarios start with the same cash: the deposit plus buying costs. The buyer spends it on the house, and the renter invests it.
- Each month, both spend the same. The buyer pays the mortgage plus running costs (a % of price), and the renter pays rent. Whoever's month is cheaper invests the difference.
- At sale, the buyer gets home value minus the mortgage left and selling costs, plus their investments. The renter has their investments.
- Not modelled: tax on investment gains (assumes an ISA), inflation, and stamp duty varying with price (buying costs are a fixed amount).

## Mortgage rates

Unless you type a rate, it's looked up from the loan-to-value. The source is the Bank of England's average quoted 2-year fixed rate for the 60/75/85/90/95% LTV bands, and the same rate is assumed after the 2-year fix ends. The BoE database blocks browser requests, so the rates are kept as a snapshot in `data/rates.js`. To refresh it:

```
node scripts/update-rates.js
```

## Tests

```
node --test tests/model.test.js
```
