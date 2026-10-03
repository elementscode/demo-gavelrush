import { Job, email, sql } from "@elements/app";
import OutbidEmail from "#app/emails/outbid";
import { closeTime, money } from "#app/shared/lot";

export interface SendOutbidEmailJobFields {
  lotId: string;
  userId: string;
  amount: number;
}

interface Outbid {
  email: string;
  name: string;
  number: number;
  title: string;
  currentBid: number;
  increment: number;
  closesAt: Date;
}

/**
 * Tells a bidder they were outbid. Checked again at send time: a bidder who has
 * unwatched the lot, or has already bid back on top, gets nothing.
 */
export class SendOutbidEmailJob extends Job<SendOutbidEmailJobFields> {
  static maxAttempts = 5;

  run() {
    let { lotId, userId, amount } = this.fields;

    let row = sql<Outbid>(`
      select u.email, u.name, l.number, l.title, l.currentBid, l.increment, l.closesAt
        from lots l
        join watches w on w.lotId = l.id and w.userId = ${userId}
        join users u on u.id = ${userId}
       where l.id = ${lotId}
         and l.status = 'open'
         and l.topBidderId is distinct from ${userId}
    `).first();

    if (!row) {
      return;
    }

    email({
      to: row.email,
      subject: `You've been outbid on lot ${row.number}: ${row.title}`,
      body: new OutbidEmail({
        name: row.name.split(" ")[0],
        lotId,
        lotNumber: row.number,
        title: row.title,
        amount: money(amount),
        minimum: money(row.currentBid + row.increment),
        closes: closeTime(row.closesAt),
      }),
    });
  }
}
