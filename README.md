# Rent vs Buy Calculator

A UK rent-vs-buy calculator built around one question: **how long do you need to stay for buying to beat renting?**

Open `index.html` in a browser. There's no build step and no dependencies. Inputs are saved in the URL, so you can share a scenario by copying the link.

## The break-even graph

The main chart shows house price on the x-axis and the **years you'd need to stay for buying to beat renting** on the y-axis.

- Under the curve (red), you'd sell before buying catches up, so renting wins. Above it, buying wins.
- The blue strip is the range of years you expect to stay (1–5 by default). Wherever the curve runs through or below it, buying works for you.
- The grey band shows the same curve across your deposit range. The deposit makes little difference.
- The "Most you should pay" table reads the curve for each whole year of stay.

You set the home you're looking at with three sliders: price, deposit and length of stay. A second chart follows that home month by month, with a band for house prices growing 2 points a year faster or slower.

## The model

- Both scenarios start with the same cash: the deposit plus buying costs. The buyer spends it on the house, and the renter invests it.
- Each month, both have the same budget: rent plus monthly savings (£1,000 by default). The renter pays rent and invests the savings. The buyer pays the mortgage plus running costs (a % of price) and invests what's left. The savings are equal on both sides, so they change how much each ends up with but not who wins.
- At sale, the buyer gets home value minus the mortgage left and selling costs, plus their investments. The renter has their investments.
- Break-even is the first month from which buying stays ahead.
- The mortgage rate is an input and is assumed to stay the same for the whole stay.
- Not modelled: tax on investment gains (assumes an ISA), inflation, and stamp duty varying with price (buying costs are a fixed amount).

## Tests

```
node --test tests/model.test.js
```
