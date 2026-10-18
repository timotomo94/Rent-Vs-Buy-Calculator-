# Rent vs Buy Calculator

A UK rent-vs-buy calculator built around one question: **how long do you need to stay for buying to beat renting?**

Open `index.html` in a browser. There's no build step and no dependencies. Inputs are saved in the URL, so you can share a scenario by copying the link.

## On your phone

The app is built to be used on a phone. The deposit, service charge + ground rent, and mortgage rate sliders are pinned to the bottom of the screen. Everything else sits in a panel that slides out from the left: tap **Inputs** or swipe in from the left edge.

It's also an installable web app (a PWA). Once it's hosted over HTTPS (for example on GitHub Pages), open it on your phone and add it to your home screen:

- iPhone (Safari): tap Share, then **Add to Home Screen**.
- Android (Chrome): open the menu, then **Install app**.

It then opens full screen like a native app and works offline.

## The break-even map

The main chart has house price on the x-axis and the time until you sell on the y-axis. Every point is coloured by how much better off buying leaves you than renting:

- **Blue:** buying ahead.
- **Red:** renting ahead.
- **Pale:** about even.
- The colours are strongest at £50k either way.

- The black line is the **break-even**: for each price, how long you'd need to stay for buying to catch up. Below it renting wins; above it buying wins.
- The two horizontal lines mark the range of years you expect to stay (1–5 by default), and the vertical line marks the home you're looking at.
- Tap or hover anywhere for the exact amount and that price's break-even. The "Most you should pay" table reads the line for each whole year of stay.

Three sliders set the deposit, the yearly service charge + ground rent, and the mortgage rate. The price of the home you're looking at is in the Inputs panel. A second chart follows that home month by month up to the end of your stay range, with a band for house prices growing 2 points a year faster or slower.

At the bottom, **Mortgage repayments and equity** lists, for each year shown on the map, your equity (home value minus mortgage left, before selling costs), how much of the home you own, and how each year's payments split into loan repaid and interest. A repayment mortgage is mostly interest at first, so equity grows slowly early on. The rows inside your stay range are shaded.

## The model

- Both scenarios start with the same cash: the deposit plus buying costs. The buyer spends it on the house, and the renter invests it.
- Each month, both have the same budget: rent plus monthly savings (£1,000 by default). The renter pays rent and invests the savings. The buyer pays the mortgage plus running costs (maintenance and insurance as a fixed £ a year, plus service charge and ground rent) and invests what's left. The savings are equal on both sides, so they change how much each ends up with but not who wins.
- At sale, the buyer gets home value minus the mortgage left and selling costs, plus their investments. The renter has their investments.
- Break-even is the first month from which buying stays ahead.
- The mortgage rate is an input and is assumed to stay the same for the whole stay.
- Not modelled: tax on investment gains (assumes an ISA), inflation, and stamp duty varying with price (buying costs are a fixed amount).

## Releasing a change

When you change any file the page loads, bump the `?v=` number on the stylesheet and script links in `index.html` and the `CACHE` name in `sw.js`. Phones that already have the app then fetch every new file together, instead of mixing a cached old script with the new page.

## Tests

```
node --test tests/model.test.js
```
