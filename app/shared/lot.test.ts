import { test, equal } from "@elements/app";
import { minimumBid, countdown, money } from "#app/shared/lot";

test("lot helpers", () => {
  test("minimum bid", () => {
    equal(minimumBid({ currentBid: null, startingBid: 100, increment: 10 }), 100);
    equal(minimumBid({ currentBid: 150, startingBid: 100, increment: 25 }), 175);
  });

  test("countdown", () => {
    equal(countdown(65_000), "1m 05s");
    equal(countdown((3 * 3600 + 5 * 60) * 1000), "3h 05m");
    equal(countdown((2 * 86400 + 4 * 3600 + 60) * 1000), "2d 4h 1m");
  });

  test("money", () => {
    equal(money(1500), "$1,500");
    equal(money(null), "–");
  });
});
