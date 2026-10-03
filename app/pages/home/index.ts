import { Request, Response, session } from "@elements/app";
import { lots, watches } from "#app/shared/services/lots";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = session.get("userId");

  return new html({
    lots: lots.view(),
    watches: userId ? watches.view({ userId }) : null,
    serverNow: new Date(),
  });
}
