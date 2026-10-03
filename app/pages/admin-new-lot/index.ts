import { Request, Response } from "@elements/app";
import { isUserAdminOrThrow } from "#app/shared/services/auth";
import html from "./template";

export default function route(req: Request, res: Response) {
  isUserAdminOrThrow();

  return new html({ serverNow: new Date() });
}
