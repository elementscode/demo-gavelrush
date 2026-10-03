import { Request, Response } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/auth";
import { lots } from "#app/shared/services/lots";
import html from "./template";

export default function route(req: Request, res: Response) {
  isUserAdminOrThrow();

  return new html({ lots: lots.view(), serverNow: new Date() });
}
