import { test, assert, equal, sql, ForbiddenError, NotFoundError } from "@elements/app";
import { CloseLotsJob } from "#app/jobs/close-lots";
import { placeBid, lots } from "#app/shared/services/lots";
import { owedLot, recordPayment, startCheckout } from "#app/shared/checkout";
import { testCheckout } from "#app/shared/stripe";
import { thrown, makeUser, loginAs, makeLot, lotState } from "#app/shared/testing";
import { loadTestCheckoutLot, payTestLot } from "./services";

/** A lot Ada won at $150, closed and waiting for her payment. */
function wonLot(): { lot: string; ada: string } {
  let lot = makeLot({ startingBid: 150 });
  let ada = makeUser("Ada Lovelace");
  loginAs(ada);
  placeBid(lot, 150);
  sql(`update lots set closesAt = now() - interval '1 second' where id = ${lot}`);
  new CloseLotsJob({}).run();

  return { lot, ada };
}

function paymentsFor(lotId: string) {
  return sql<{ stripeSessionId: string; userId: string; amountTotal: number; currency: string }>(`
    select stripeSessionId, userId, amountTotal, currency from payments where lotId = ${lotId}
  `).all();
}

// Tests run against the environment's config: development without a key has
// the test checkout, while development with a key and production go to
// Stripe. The checkout flow is driven end to end when the test checkout is on;
// recordPayment, which every payment goes through, is tested everywhere.
test("checkout", async () => {
  test("recordPayment marks the lot paid once, however often it is called", async () => {
    let { lot, ada } = wonLot();

    recordPayment("cs_test_one", lot, ada, 15000, "usd");
    recordPayment("cs_test_one", lot, ada, 15000, "usd");

    equal(lotState(lot).paymentStatus, "paid");
    equal(paymentsFor(lot).length, 1);
    equal(owedLot(lot, ada), undefined);

    let row = lots.view().find((l) => l.id === lot)!;
    equal(row.paymentStatus, "paid");
    assert(row.paidAt instanceof Date, "paidAt is set");
  });

  test("only the winner owes the lot", async () => {
    let { lot, ada } = wonLot();
    let grace = makeUser("Grace Hopper");

    equal(owedLot(lot, ada)?.currentBid, 150);
    equal(owedLot(lot, grace), undefined);
  });

  test("the winner checks out and pays on the test checkout", async () => {
    let { lot, ada } = wonLot();

    if (!testCheckout()) {
      let err = await thrown(() => payTestLot(lot));
      assert(err instanceof ForbiddenError, `got ${err}`);
      equal(lotState(lot).paymentStatus, "unpaid");
      return;
    }

    let url = await startCheckout(owedLot(lot, ada)!, ada);
    equal(url, `/checkout/test/${lot}`);

    let shown = loadTestCheckoutLot(lot);
    equal(shown.amount, 150);
    equal(shown.title, "Test lot");

    payTestLot(lot);

    equal(lotState(lot).paymentStatus, "paid");

    let payments = paymentsFor(lot);
    equal(payments.length, 1);
    equal(payments[0].stripeSessionId, `test_${lot}`);
    equal(payments[0].userId, ada);
    equal(payments[0].amountTotal, 15000);
    equal(payments[0].currency, "usd");

    let again = await thrown(() => payTestLot(lot));
    assert(again instanceof NotFoundError, `got ${again}`);
    equal(paymentsFor(lot).length, 1);
  });

  test("nobody but the winner can pay on the test checkout", async () => {
    let { lot } = wonLot();
    loginAs(makeUser("Grace Hopper"));

    let err = await thrown(() => payTestLot(lot));
    assert(err instanceof (testCheckout() ? NotFoundError : ForbiddenError), `got ${err}`);
    equal(lotState(lot).paymentStatus, "unpaid");
  });
});
