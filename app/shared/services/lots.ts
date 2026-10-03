import { LiveTable, sql, tx, session, ValidationError, NotFoundError, ForbiddenError } from "@elements/app";
import { LotRow, BidRow, WatchRow, EXTEND_WINDOW_MS, minimumBid } from "#app/shared/lot";
import { SendOutbidEmailJob } from "#app/jobs/send-outbid-email";

/**
 * Every lot, with its photos and the names beside its bids. The lots trigger
 * notifies `lots` with the row id on any write, from a bid, the close job or a
 * payment, and each app server reads the row back through this select.
 */
export let lots: LiveTable<LotRow> = new LiveTable<LotRow>({
  select: () => sql<LotRow>(`
    select l.id, l.number, l.title, l.description, l.startingBid, l.increment,
           l.closesAt, l.currentBid, l.bidCount, l.topBidderId,
           shortName(tb.name) as topBidderName,
           l.status, l.winnerId, w.name as winnerName, l.paymentStatus, l.paidAt,
           coalesce(
             (select array_agg(case when p.asset is not null then 'seed:' || p.asset
                                    else '/photos/' || p.id || '/' || p.hash end
                               order by p.position)
                from lotPhotos p where p.lotId = l.id),
             '{}'
           ) as photos,
           l.createdAt
      from lots l
      left join users tb on tb.id = l.topBidderId
      left join users w on w.id = l.winnerId
     order by l.closesAt
  `),

  insert: () => { throw new ForbiddenError(); },
  update: () => { throw new ForbiddenError(); },
  delete: () => { throw new ForbiddenError(); },
});

/** One lot's bid history, partitioned so a page hears only its own lot. */
export let bids: LiveTable<BidRow> = new LiveTable<BidRow>({
  select: ({ lotId }) => sql<BidRow>(`
    select b.id, b.lotId, b.userId, shortName(u.name) as bidderName, b.amount, b.createdAt
      from bids b
      join users u on u.id = b.userId
     where b.lotId = ${lotId}
     order by b.amount desc
  `),

  insert: () => { throw new ForbiddenError(); },
  update: () => { throw new ForbiddenError(); },
  delete: () => { throw new ForbiddenError(); },
});

/** The signed-in bidder's watchlist. The route opens it on their own id. */
export let watches: LiveTable<WatchRow> = new LiveTable<WatchRow>({
  insert: (item) => {
    if (item.userId !== session.getOrThrow("userId")) {
      throw new ForbiddenError();
    }

    return sql<WatchRow>(`
      insert into watches (id, lotId, userId)
      values (${item.id}, ${item.lotId}, ${item.userId})
      on conflict (lotId, userId) do update set updatedAt = now()
      returning id, lotId, userId
    `).firstOrThrow();
  },

  update: () => { throw new ForbiddenError(); },

  delete: (item) => {
    sql(`delete from watches where id = ${item.id} and userId = ${session.getOrThrow("userId")}`);
  },
});

interface LockedLot {
  id: string;
  title: string;
  startingBid: number;
  increment: number;
  currentBid: number | null;
  topBidderId: string | null;
  closesAt: Date;
  status: "open" | "closed";
  msLeft: number;
}

/**
 * Places a bid. The row lock serializes bidders on one lot, so two bids for
 * the same amount cannot both win, and the close time is read under the same
 * lock that extends it.
 */
/** @rpc */
export function placeBid(lotId: string, amount: number) {
  let userId = session.getOrThrow("userId");

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("Enter a whole-dollar amount.");
  }

  tx(() => {
    let lot = sql<LockedLot>(`
      select id, title, startingBid, increment, currentBid, topBidderId, closesAt, status,
             extract(epoch from (closesAt - now())) * 1000 as msLeft
        from lots where id = ${lotId}
         for update
    `).first();

    if (!lot) {
      throw new NotFoundError("That lot doesn't exist.");
    }

    if (lot.status === "closed" || lot.msLeft <= 0) {
      throw new ValidationError("Bidding on this lot has closed.");
    }

    if (lot.topBidderId === userId) {
      throw new ValidationError("You're already the high bidder.");
    }

    let min = minimumBid(lot);

    if (amount < min) {
      throw new ValidationError(`Bid at least $${min.toLocaleString("en-US")}.`);
    }

    let extend = lot.msLeft <= EXTEND_WINDOW_MS;

    sql(`insert into bids (lotId, userId, amount) values (${lotId}, ${userId}, ${amount})`);

    sql(`
      update lots
         set currentBid = ${amount},
             topBidderId = ${userId},
             bidCount = bidCount + 1,
             closesAt = case when ${extend} then closesAt + ${EXTEND_WINDOW_MS / 1000} * interval '1 second' else closesAt end
       where id = ${lotId}
    `);

    sql(`insert into watches (lotId, userId) values (${lotId}, ${userId}) on conflict do nothing`);

    if (lot.topBidderId) {
      new SendOutbidEmailJob({ lotId, userId: lot.topBidderId, amount }).schedule();
    }
  });
}
