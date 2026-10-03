import { getAppUrl, sql, tx } from "@elements/app";
import { stripe, testCheckout } from "#app/shared/stripe";
import { ensureWebhook } from "#app/shared/stripe-webhook";

export interface Owed {
  id: string;
  number: number;
  title: string;
  currentBid: number;
  email: string;
}

/**
 * The closed, unpaid lot this bidder won, or nothing. The amount comes from
 * the row, never from the browser.
 */
export function owedLot(lotId: string, userId: string): Owed | undefined {
  return sql<Owed>(`
    select l.id, l.number, l.title, l.currentBid, u.email
      from lots l
      join users u on u.id = l.winnerId
     where l.id = ${lotId}
       and l.winnerId = ${userId}
       and l.status = 'closed'
       and l.paymentStatus = 'unpaid'
  `).first();
}

/** Returns the url to send the winner to: Stripe, or the test checkout. */
export async function startCheckout(lot: Owed, userId: string): Promise<string> {
  if (testCheckout()) {
    return `/checkout/test/${lot.id}`;
  }

  await ensureWebhook();

  let checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: lot.email,
    client_reference_id: lot.id,
    metadata: { lotId: lot.id, userId },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: lot.currentBid * 100,
        product_data: { name: `Lot ${lot.number}: ${lot.title}` },
      },
    }],
    success_url: `${getAppUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/lots/${lot.id}`,
  });

  return checkout.url!;
}

/**
 * Records a paid session. Idempotent: the return page and the webhook both
 * call it, in either order, any number of times. Returns the lot id when the
 * session is paid.
 */
export async function fulfillCheckout(sessionId: string): Promise<string | null> {
  let checkout = await stripe().checkout.sessions.retrieve(sessionId);
  let lotId = checkout.client_reference_id;
  let userId = checkout.metadata?.userId;

  if (checkout.payment_status !== "paid" || !lotId || !userId) {
    return null;
  }

  recordPayment(checkout.id, lotId, userId, checkout.amount_total!, checkout.currency!);

  return lotId;
}

/**
 * The one place a payment is recorded, real or test. Marking the lot paid
 * notifies the lots LiveTable, so the winner's lot page and the admin's
 * results update on every open screen.
 */
export function recordPayment(sessionId: string, lotId: string, userId: string, amountTotal: number, currency: string) {
  tx(() => {
    sql(`
      insert into payments (stripeSessionId, lotId, userId, amountTotal, currency)
      values (${sessionId}, ${lotId}, ${userId}, ${amountTotal}, ${currency})
      on conflict (stripeSessionId) do nothing
    `);

    sql(`
      update lots set paymentStatus = 'paid', paidAt = now()
       where id = ${lotId}
         and paymentStatus = 'unpaid'
    `);
  });
}
