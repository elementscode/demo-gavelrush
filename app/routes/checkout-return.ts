import { Request, Response, redirect } from "@elements/app";
import { fulfillCheckout } from "#app/shared/checkout";

/** Stripe sends the buyer here after paying; the lot page shows the receipt. */
export default async function checkoutReturn(req: Request, res: Response) {
  let lotId = await fulfillCheckout(String(req.query.session_id));

  redirect(lotId ? `/lots/${lotId}` : "/");
}
