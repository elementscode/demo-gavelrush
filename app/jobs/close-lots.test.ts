import { test, assert, equal, sql } from "@elements/app";
import { CloseLotsJob } from "#app/jobs/close-lots";
import { placeBid } from "#app/shared/services/lots";
import { makeUser, loginAs, makeLot, lotState } from "#app/shared/testing";

test("CloseLotsJob", async () => {
  test("closes lots past their time and records the winner", async () => {
    let lot = makeLot({ closesInSeconds: 30 });
    let ada = makeUser("Ada Lovelace");
    loginAs(ada);
    placeBid(lot, 100);
    sql(`update lots set closesAt = now() - interval '1 second' where id = ${lot}`);

    new CloseLotsJob({}).run();

    let s = lotState(lot);
    equal(s.status, "closed");
    equal(s.winnerId, ada);
    equal(s.paymentStatus, "unpaid");

    let queued = sql<{ n: number }>(`
      select count(*)::int as n from elements.jobs
       where path like '%send-won-email%' and fields ->> 'lotId' = ${lot}
    `).firstOrThrow().n;
    equal(queued, 1);
  });

  test("a lot with no bids closes with no winner", async () => {
    let lot = makeLot({ closesInSeconds: -1 });

    new CloseLotsJob({}).run();

    equal(lotState(lot).status, "closed");
    equal(lotState(lot).paymentStatus, "none");
  });

  test("open lots stay open", async () => {
    let lot = makeLot({ closesInSeconds: 600 });

    new CloseLotsJob({}).run();

    equal(lotState(lot).status, "open");
  });
});
