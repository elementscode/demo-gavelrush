import { ForbiddenError, NotFoundError, session, sql } from "@elements/app";
import { recordPayment } from "#app/shared/checkout";
import { testCheckout } from "#app/shared/stripe";

export interface TestCheckoutLot {
  id: string;
  number: number;
  title: string;
  amount: number;
  bidCount: number;
  photo: string | null;
}

/**
 * The closed, unpaid lot the signed-in bidder won, with what the test
 * checkout shows. Throws unless the test checkout is on and the lot is owed.
 */
export function loadTestCheckoutLot(lotId: string): TestCheckoutLot {
  if (!testCheckout()) {
    throw new NotFoundError();
  }

  let userId = session.getOrThrow("userId");
  let lot = sql<TestCheckoutLot>(`
    select l.id, l.number, l.title, l.currentBid as amount, l.bidCount,
           (select case when p.asset is not null then 'seed:' || p.asset
                        else '/photos/' || p.id || '/' || p.hash end
              from lotPhotos p
             where p.lotId = l.id
             order by p.position
             limit 1) as photo
      from lots l
     where l.id = ${lotId}
       and l.winnerId = ${userId}
       and l.status = 'closed'
       and l.paymentStatus = 'unpaid'
  `).first();

  if (!lot) {
    throw new NotFoundError("There is nothing to pay for this lot.");
  }

  return lot;
}

/**
 * Pays for a won lot on the in-app test checkout, through the same
 * recordPayment a Stripe payment uses. Development without a key only.
 *
 * @rpc
 */
export function payTestLot(lotId: string) {
  if (!testCheckout()) {
    throw new ForbiddenError("The test checkout is off.");
  }

  let lot = loadTestCheckoutLot(lotId);

  recordPayment(`test_${lot.id}`, lot.id, session.getOrThrow("userId"), lot.amount * 100, "usd");
}
