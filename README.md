![Gavelrush, a live charity auction built with Elements: the lots grid with photos, current bids, countdowns and one lot closing in minutes, above the running total bid.](https://elements.dev/demos/01a0f446-8df0-7740-8f04-4a1ad444930e/poster?v=de3e5a1f2dd7)

# Gavelrush

> A demo app built with [Elements](https://elements.dev).

Lots with photos and countdowns, bids at a set increment, late bids that extend the close, outbid emails, and pay-by-card links.

**Demo:** [Gavelrush](https://elements.dev/demos/01a0f446-8df0-7740-8f04-4a1ad444930e)

## Agent specs

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 22 min
- **Cost:** $6.56 at API rates, September 2026

## Get started

```bash
elements create gavelrush -scaffold=elementscode/demo-gavelrush
```

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

### What Elements gave the app

- **Live lots and bids.** Lots, bids and watchlists are LiveTables. A bid lands on every open lot card, countdown and the admin's total raised the moment it is placed, and each lot page hears only its own bid history.

- **Bidding as a function call.** The lot page places a bid through an `@rpc` server function that locks the lot, checks the increment, extends the close by two minutes when a bid comes in late, and queues the outbid email, all in one transaction.

- **Jobs and email.** A one-line cron schedule closes lots every minute, records each winner and queues the winner's email with a link to pay. The outbid email checks at send time that the bidder is still behind.

- **Card payments.** The winner pays through Stripe for the amount on the lot, and the payment is recorded once whether the return page or Stripe's webhook arrives first. Without a Stripe key, a test checkout inside the app records payments through the same function, and in production the app registers its own webhook on the first checkout.

- **Photos in the database.** The admin uploads lot photos straight through a server call, and the app serves each one at an address browsers keep for a year.

- **Data from SQL files.** Migrations define the auction and seed one admin, four bidders and twelve lots with photos, bids and watchlists, one closing in minutes.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 28 tests pass. Every page works on desktop and phone. A real sandbox payment went through Stripe end to end.

## Seed data and demo accounts

The seed creates twelve donated lots with photos, bids and watchlists. Close
times run from twelve minutes after the seed runs (lot 1, the film camera) out
to four days. A job closes each lot at its time and emails the winner a link to
pay. The sign-in page lists the accounts and fills the form when you click one.

| Email                    | Password      | Role   |
| ------------------------ | ------------- | ------ |
| admin@gavelrush.test     | `admin-pass`  | admin  |
| ada@gavelrush.test       | `bidder-pass` | bidder |
| grace@gavelrush.test     | `bidder-pass` | bidder |
| alan@gavelrush.test      | `bidder-pass` | bidder |
| katherine@gavelrush.test | `bidder-pass` | bidder |

The admin creates lots at `/admin/lots/new` and sees each lot's winner, amount,
payment status and the total raised at `/admin`. To start the week over, run
`elements db reset`.

Lot photos are CC0 or public domain, from Openverse.

**Demo:** [Gavelrush](https://elements.dev/demos/01a0f446-8df0-7740-8f04-4a1ad444930e)

## License

MIT. See [LICENSE](LICENSE).
