import { test, assert, equal, sql, ValidationError } from "@elements/app";
import { placeBid, lots, bids } from "#app/shared/services/lots";
import { thrown, makeUser, loginAs, makeLot, lotState } from "#app/shared/testing";

test("placeBid", async () => {
  test("the first bid must meet the starting bid", async () => {
    let lot = makeLot({ startingBid: 100 });
    loginAs(makeUser("Ada Lovelace"));

    let err = await thrown(() => placeBid(lot, 99));
    assert(err instanceof ValidationError, `got ${err}`);
    equal(err.message, "Bid at least $100.");

    placeBid(lot, 100);
    equal(lotState(lot).currentBid, 100);
    equal(lotState(lot).bidCount, 1);
  });

  test("a later bid must beat the current bid by the increment", async () => {
    let lot = makeLot({ startingBid: 100, increment: 25 });
    loginAs(makeUser("Ada Lovelace"));
    placeBid(lot, 100);

    loginAs(makeUser("Grace Hopper"));
    let err = await thrown(() => placeBid(lot, 120));
    assert(err instanceof ValidationError, `got ${err}`);
    equal(err.message, "Bid at least $125.");

    placeBid(lot, 125);
    equal(lotState(lot).currentBid, 125);
  });

  test("the high bidder cannot bid against themselves", async () => {
    let lot = makeLot();
    loginAs(makeUser("Ada Lovelace"));
    placeBid(lot, 100);

    let err = await thrown(() => placeBid(lot, 200));
    assert(err instanceof ValidationError, `got ${err}`);
  });

  test("a bid in the last two minutes adds two minutes", async () => {
    let lot = makeLot({ closesInSeconds: 60 });
    loginAs(makeUser("Ada Lovelace"));
    placeBid(lot, 100);

    let left = lotState(lot).msLeft;
    assert(left > 170_000 && left <= 180_000, `closes in ${left}ms`);
  });

  test("a bid earlier than that leaves the close alone", async () => {
    let lot = makeLot({ closesInSeconds: 600 });
    loginAs(makeUser("Ada Lovelace"));
    placeBid(lot, 100);

    assert(lotState(lot).msLeft <= 600_000);
  });

  test("a lot past its close time takes no bids", async () => {
    let lot = makeLot({ closesInSeconds: -5 });
    loginAs(makeUser("Ada Lovelace"));

    let err = await thrown(() => placeBid(lot, 500));
    assert(err instanceof ValidationError, `got ${err}`);
    equal(err.message, "Bidding on this lot has closed.");
  });

  test("bidding watches the lot and queues an outbid email for the previous leader", async () => {
    let lot = makeLot();
    let ada = makeUser("Ada Lovelace");
    loginAs(ada);
    placeBid(lot, 100);

    loginAs(makeUser("Grace Hopper"));
    placeBid(lot, 110);

    let watching = sql(`select 1 from watches where lotId = ${lot} and userId = ${ada}`).empty();
    assert(!watching, "ada watches the lot she bid on");

    let queued = sql<{ n: number }>(`
      select count(*)::int as n from elements.jobs
       where path like '%send-outbid-email%' and fields ->> 'userId' = ${ada}
    `).firstOrThrow().n;
    equal(queued, 1);
  });

  test("a signed-out visitor cannot bid", async () => {
    let lot = makeLot();

    assert(await thrown(() => placeBid(lot, 100)) !== null);
    equal(lotState(lot).bidCount, 0);
  });
});

test("views", async () => {
  test("lots carry photos and a short bidder name", async () => {
    let lot = makeLot();
    sql(`insert into lotPhotos (lotId, name, contentType, asset) values (${lot}, 'watch-1.jpg', 'image/jpeg', 'watch-1')`);
    loginAs(makeUser("Ada Lovelace"));
    placeBid(lot, 100);

    let row = lots.view().get(lot)!;
    equal(row.photos.length, 1);
    equal(row.photos[0], "seed:watch-1");
    equal(row.topBidderName, "Ada L.");
  });

  test("bid history is one lot's bids", async () => {
    let a = makeLot();
    let b = makeLot();
    loginAs(makeUser("Ada Lovelace"));
    placeBid(a, 100);
    placeBid(b, 100);

    equal(bids.view({ lotId: a }).length, 1);
  });
});
