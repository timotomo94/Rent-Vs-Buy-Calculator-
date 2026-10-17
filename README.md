# Rent vs Buy Calculator

A UK rent-vs-buy calculator built around one question: **how long do you need to stay for buying to beat renting?**

Open `index.html` in a browser. There's no build step and no dependencies. Inputs are saved in the URL, so you can share a scenario by copying the link.

## The payoff graph

The x-axis is the year you sell. The y-axis is how much better off buying leaves you than renting, if you sell then.

- The curve starts below £0. Buying and selling costs (£8,000 + £5,000 by default) are a hole you have to climb out of.
- The point where it crosses £0 is the **break-even**. Stay longer than that and buying wins.
- The grey band shows the same curve if house prices grow 2 points a year faster or slower. House price growth is the assumption that moves the answer most.
- A second chart shows what you'd walk away with in each scenario, and the year-by-year table has the numbers behind both charts.

## The model

- Both scenarios start with the same cash: the deposit plus buying costs. The buyer spends it on the house, and the renter invests it.
- Each month, both spend the same. The buyer pays the mortgage plus running costs, and the renter pays rent. Whoever's month is cheaper invests the difference.
- At sale, the buyer gets home value minus the mortgage left and selling costs, plus their investments. The renter has their investments.
- Not modelled: tax on investment gains (assumes an ISA), inflation, and moving more than once.

## Tests

```
node --test tests/model.test.js
```
