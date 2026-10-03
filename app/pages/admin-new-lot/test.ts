import { test, assert, equal, sql, File, ValidationError, ForbiddenError } from "@elements/app";
import { createLot } from "./template";
import { thrown, makeUser, loginAs } from "#app/shared/testing";

function photo(): File {
  let data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

  return new File({ name: "p.jpg", size: data.length, contentType: "image/jpeg", data, lastModified: new Date() });
}

function lot(overrides: object = {}) {
  return {
    title: "Pottery class",
    description: "Four weeks of wheel throwing.",
    startingBid: 80,
    increment: 5,
    closesAt: new Date(Date.now() + 86400_000),
    photos: [photo()],
    ...overrides,
  };
}

test("createLot", async () => {
  test("an admin creates a lot with its photos", async () => {
    loginAs(makeUser("Morgan Reyes", "admin"));

    let id = createLot(lot());

    let row = sql<{ title: string; photos: number }>(`
      select title, (select count(*)::int from lotPhotos where lotId = ${id}) as photos from lots where id = ${id}
    `).firstOrThrow();
    equal(row.title, "Pottery class");
    equal(row.photos, 1);
  });

  test("bad fields come back per field", async () => {
    loginAs(makeUser("Morgan Reyes", "admin"));

    let err = await thrown(() => createLot(lot({ title: " ", startingBid: 0, closesAt: new Date(Date.now() - 1000), photos: [] })));
    assert(err instanceof ValidationError, `got ${err}`);
    let e = err.errors ?? {};
    assert(e.title && e.startingBid && e.closesAt && e.photos, JSON.stringify(e));
  });

  test("a bidder cannot create lots", async () => {
    loginAs(makeUser("Ada Lovelace"));

    assert(await thrown(() => createLot(lot())) instanceof ForbiddenError);
  });
});
