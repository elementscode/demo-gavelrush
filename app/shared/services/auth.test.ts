import { test, assert, equal, session, AuthError, ForbiddenError } from "@elements/app";
import { signin, signup, isUserAdminOrThrow, safeNext } from "#app/shared/services/auth";
import { thrown, makeUser, loginAs } from "#app/shared/testing";

/** A fresh address per test, so a parallel run never inserts the same email. */
function email(): string {
  return `ada.${crypto.randomUUID().slice(0, 8)}@example.com`;
}

test("auth", async () => {
  test("signup creates a bidder and signs them in", async () => {
    signup("Ada Lovelace", `${email().toUpperCase()} `, "longenough");

    equal(session.get("userName"), "Ada Lovelace");
    equal(session.get("role"), "bidder");
  });

  test("signup refuses a taken email", async () => {
    let address = email();
    signup("Ada Lovelace", address, "longenough");

    let err = await thrown(() => signup("Someone Else", address.toUpperCase(), "longenough"));
    assert(err instanceof AuthError, `got ${err}`);
  });

  test("signin checks the password", async () => {
    let address = email();
    signup("Ada Lovelace", address, "longenough");
    session.logout();

    assert(await thrown(() => signin(address, "wrong-password")) instanceof AuthError);

    signin(address, "longenough");
    assert(session.isLoggedIn());
  });

  test("admin pages refuse bidders", async () => {
    loginAs(makeUser("Ada Lovelace"));
    assert(await thrown(() => isUserAdminOrThrow()) instanceof ForbiddenError);

    loginAs(makeUser("Morgan Reyes", "admin"));
    equal(await thrown(() => isUserAdminOrThrow()), null);
  });

  test("next only follows same-site paths", async () => {
    equal(safeNext("/pay/abc"), "/pay/abc");
    equal(safeNext("//evil.example"), "/");
    equal(safeNext("https://evil.example"), "/");
  });
});
