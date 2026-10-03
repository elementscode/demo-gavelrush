import { sql, session, AuthError, ForbiddenError, SqlError } from "@elements/app";

interface User {
  id: string;
  email: string;
  name: string;
  role: "bidder" | "admin";
}

export const MIN_PASSWORD = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function login(user: User) {
  session.login({ userId: user.id, userName: user.name, role: user.role });
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = normalizeEmail(email);

  if (!address || !password) {
    throw new AuthError("Enter your email and password.");
  }

  let user = sql<User>(`
    select id, email, name, role from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("That email and password don't match an account.");
  }

  login(user);
}

/** @rpc */
export function signup(name: string, email: string, password: string) {
  let address = normalizeEmail(email);
  let displayName = name.trim();

  if (!displayName) {
    throw new AuthError("Enter your name. It shows next to your bids.");
  }

  if (!isEmail(address)) {
    throw new AuthError("Enter a valid email address.");
  }

  if (password.length < MIN_PASSWORD) {
    throw new AuthError(`Your password needs at least ${MIN_PASSWORD} characters.`);
  }

  let user: User;

  try {
    user = sql<User>(`
      insert into users (email, name, passwordHash)
      values (${address}, ${displayName}, crypt(${password}, genSalt('bf', 12)))
      returning id, email, name, role
    `).firstOrThrow();
  } catch (err) {
    if (err instanceof SqlError) {
      throw new AuthError("That email is already registered. Sign in instead.");
    }

    throw err;
  }

  login(user);
}

/** @rpc */
export function signout() {
  session.logout();
}

export function isUserAdmin(userId: string): boolean {
  return !sql(`select 1 from users where id = ${userId} and role = 'admin'`).empty();
}

export function isUserAdminOrThrow() {
  session.isLoggedInOrThrow();

  if (!isUserAdmin(session.getOrThrow("userId"))) {
    throw new ForbiddenError("Admin access required.");
  }
}

/** Only same-site paths, so a crafted link can't bounce a bidder elsewhere. */
export function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/";
}
