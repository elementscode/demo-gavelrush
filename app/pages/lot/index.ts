import { Request, Response, NotFoundError, session, sql } from "@elements/app";
import { lots, bids, watches } from "#app/shared/services/lots";
import html from "./template";

export default function route(req: Request, res: Response) {
  let lotId = req.params.id;

  if (!/^[0-9a-f-]{36}$/.test(lotId) || sql(`select 1 from lots where id = ${lotId}`).empty()) {
    throw new NotFoundError("That lot doesn't exist.");
  }

  let userId = session.get("userId");

  return new html({
    lotId,
    lots: lots.view(),
    bids: bids.view({ lotId }),
    watches: userId ? watches.view({ userId }) : null,
    serverNow: new Date(),
  });
}
