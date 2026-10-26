![A live online auction with outbid emails, built by Claude Code on Elements: the lots grid with photos, current bids, countdowns and one lot closing in minutes, above the running total bid.](https://elements.dev/demos/01a0f446-8df0-7740-8f04-4a1ad444930e/poster?v=de3e5a1f2dd7)

# A live online auction with outbid emails, built by Claude Code on Elements

> Gavelrush is a full-stack app built with Claude Code on Elements.

Lots with photos and countdowns, bids at a set increment, late bids that extend the close, outbid emails, and pay-by-card links.

[Run this app on your machine](https://elements.dev/demos/01a0f446-8df0-7740-8f04-4a1ad444930e). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## Payments

Winners pay by card. Without a Stripe key, payments run through the built-in
test checkout: the winner's Pay button opens a page in the app with the lot,
the total and a Pay button, and paying marks the lot paid everywhere, just as
a real payment does. No card is collected.

For real Stripe Checkout, add a Stripe secret key (sandbox keys are free at
[dashboard.stripe.com/register](https://dashboard.stripe.com/register)) as
`STRIPE_SECRET_KEY` in `config/env/development.env`, and pay with card
4242 4242 4242 4242, any future date and any CVC. A payment is recorded when
the winner returns from Checkout, so development needs no webhook. Production
requires the key, refusing to build or start without it, and registers its
own Stripe webhook the first time a winner checks out.

In development, outbid and winner emails are written to
`.elements/logs/job.log` instead of being sent.

## How it's built

Gavelrush needed bids that land for everyone at once, a close time that moves when a late bid comes in, outbid and winner emails, photo uploads and card payments. Each of those is a part of Elements, so the agent spent its 22 minutes on the auction itself.

- **Live lots and bids.** Lots, bids and watchlists are LiveTables. A bid lands on every open lot card, countdown and the admin's total raised the moment it is placed, and each lot page hears only its own bid history.

- **Bidding as a function call.** The lot page places a bid through an `@rpc` server function that locks the lot, checks the increment, extends the close by two minutes when a bid comes in late, and queues the outbid email, all in one transaction.

- **Jobs and email.** A one-line cron schedule closes lots every minute, records each winner and queues the winner's email with a link to pay. The outbid email checks at send time that the bidder is still behind.

- **Card payments.** The winner pays through Stripe for the amount on the lot, and the payment is recorded once whether the return page or Stripe's webhook arrives first. Without a Stripe key, a test checkout inside the app records payments through the same function, and in production the app registers its own webhook on the first checkout.

- **Photos in the database.** The admin uploads lot photos straight through a server call, and the app serves each one at an address browsers keep for a year.

- **Data from SQL files.** Migrations define the auction and seed one admin, four bidders and twelve lots with photos, bids and watchlists, one closing in minutes.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
