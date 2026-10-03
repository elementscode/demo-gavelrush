import { Request, Response, redirect, session } from "@elements/app";
import { owedLot, startCheckout } from "#app/shared/checkout";

/**
 * The link in the winner's email and on the lot page. Signs them in if
 * needed, then hands them to checkout for the amount on the lot row: Stripe
 * Checkout, or the test checkout in development without a key. Anyone else,
 * or a lot already paid, lands back on the lot page, which shows its state.
 */
export default async function pay(req: Request, res: Response) {
  let lotId = req.params.id;

  if (!session.isLoggedIn()) {
    redirect(`/signin?next=${encodeURIComponent(`/pay/${lotId}`)}`);
    return;
  }

  let userId = session.getOrThrow("userId");
  let lot = owedLot(lotId, userId);

  if (!lot) {
    redirect(`/lots/${lotId}`);
    return;
  }

  redirect(await startCheckout(lot, userId));
}
