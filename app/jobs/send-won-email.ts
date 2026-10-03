import { Job, email, sql } from "@elements/app";
import WonEmail from "#app/emails/won";
import { money } from "#app/shared/lot";

export interface SendWonEmailJobFields {
  lotId: string;
}

interface Won {
  email: string;
  name: string;
  number: number;
  title: string;
  currentBid: number;
}

/** Tells the winner of a closed lot what they owe and where to pay it. */
export class SendWonEmailJob extends Job<SendWonEmailJobFields> {
  static maxAttempts = 5;

  run() {
    let { lotId } = this.fields;

    let row = sql<Won>(`
      select u.email, u.name, l.number, l.title, l.currentBid
        from lots l
        join users u on u.id = l.winnerId
       where l.id = ${lotId}
         and l.status = 'closed'
    `).first();

    if (!row) {
      return;
    }

    email({
      to: row.email,
      subject: `You won lot ${row.number}: ${row.title}`,
      body: new WonEmail({
        name: row.name.split(" ")[0],
        lotId,
        lotNumber: row.number,
        title: row.title,
        amount: money(row.currentBid),
      }),
    });
  }
}
