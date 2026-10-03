import { sql, session } from "@elements/app";

/** Runs fn and resolves to what it threw, or null when it did not throw. */
export async function thrown(fn: () => unknown): Promise<any> {
  try {
    await fn();
  } catch (err) {
    return err;
  }

  return null;
}

export function makeUser(name: string, role: "bidder" | "admin" = "bidder"): string {
  let email = name.toLowerCase().replace(/\s+/g, ".") + "@test.example";

  return sql<{ id: string }>(`
    insert into users (email, name, role, passwordHash)
    values (${email}, ${name}, ${role}::userRole, crypt('password1', genSalt('bf', 4)))
    returning id
  `).firstOrThrow().id;
}

export function loginAs(userId: string) {
  let u = sql<{ name: string; role: "bidder" | "admin" }>(`select name, role from users where id = ${userId}`).firstOrThrow();

  session.login({ userId, userName: u.name, role: u.role });
}

export function makeLot(opts: { startingBid?: number; increment?: number; closesInSeconds?: number } = {}): string {
  let seconds = opts.closesInSeconds ?? 3600;

  return sql<{ id: string }>(`
    insert into lots (title, description, startingBid, increment, closesAt)
    values ('Test lot', 'A lot for tests', ${opts.startingBid ?? 100}, ${opts.increment ?? 10}, now() + ${seconds} * interval '1 second')
    returning id
  `).firstOrThrow().id;
}

export function lotState(lotId: string) {
  return sql<{ currentBid: number | null; bidCount: number; topBidderId: string | null; msLeft: number; status: string; winnerId: string | null; paymentStatus: string }>(`
    select currentBid, bidCount, topBidderId, status, winnerId, paymentStatus,
           extract(epoch from (closesAt - now())) * 1000 as msLeft
      from lots where id = ${lotId}
  `).firstOrThrow();
}
