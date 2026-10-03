import { Request, Response, redirect, session } from "@elements/app";
import { safeNext } from "#app/shared/services/auth";
import html from "./template";

export default function route(req: Request, res: Response) {
  let next = safeNext(req.query.next);

  if (session.isLoggedIn()) {
    redirect(next);
    return;
  }

  return new html({ next });
}
