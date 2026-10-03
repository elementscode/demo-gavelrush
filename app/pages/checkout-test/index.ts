import { NotFoundError, Request, Response, redirect, session } from "@elements/app";
import { testCheckout } from "#app/shared/stripe";
import { loadTestCheckoutLot } from "./services";
import html from "./template";

/**
 * Stands in for Stripe's hosted checkout in development without a key. Gone
 * (404) once STRIPE_SECRET_KEY is set, or in production.
 */
export default function route(req: Request, res: Response) {
  if (!testCheckout()) {
    throw new NotFoundError();
  }

  let lotId = req.params.id;

  if (!session.isLoggedIn()) {
    redirect(`/signin?next=${encodeURIComponent(`/pay/${lotId}`)}`);
    return;
  }

  if (!/^[0-9a-f-]{36}$/.test(lotId)) {
    throw new NotFoundError();
  }

  return new html({ lot: loadTestCheckoutLot(lotId) });
}
