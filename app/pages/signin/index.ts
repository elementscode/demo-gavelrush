import { Request, Response, getEnv, redirect, session, sql } from "@elements/app";
import { safeNext } from "#app/shared/services/auth";
import html, { DemoLogin } from "./template";

export default function route(req: Request, res: Response) {
  let next = safeNext(req.query.next);

  if (session.isLoggedIn()) {
    redirect(next);
    return;
  }

  // The seeded accounts exist only in development, so only development lists them.
  let demoLogins = getEnv() === "development"
    ? sql<DemoLogin>(`
        select email, name, role::text as role,
               case when role = 'admin' then 'admin-pass' else 'bidder-pass' end as password
          from users
         where email like '%@gavelrush.test'
         order by role = 'admin' desc, name
      `).all()
    : [];

  return new html({ next, demoLogins });
}
