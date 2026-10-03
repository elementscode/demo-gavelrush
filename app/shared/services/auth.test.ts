import { test, assert, equal, session, AuthError, ForbiddenError } from "@elements/app";
import { signin, signup, isUserAdminOrThrow, safeNext } from "#app/shared/services/auth";
import { thrown, makeUser, loginAs } from "#app/shared/testing";

test("auth", async () => {
  test("signup creates a bidder and signs them in", async () => {
    signup("Ada Lovelace", "Ada@Example.com ", "longenough");

    equal(session.get("userName"), "Ada Lovelace");
    equal(session.get("role"), "bidder");
  });

  test("signup refuses a taken email", async () => {
    signup("Ada Lovelace", "ada@example.com", "longenough");

    let err = await thrown(() => signup("Someone Else", "ADA@example.com", "longenough"));
    assert(err instanceof AuthError, `got ${err}`);
  });

  test("signin checks the password", async () => {
    signup("Ada Lovelace", "ada@example.com", "longenough");
    session.logout();

    assert(await thrown(() => signin("ada@example.com", "wrong-password")) instanceof AuthError);

    signin("ada@example.com", "longenough");
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
