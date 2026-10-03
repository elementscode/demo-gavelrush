import { Job, sql, tx } from "@elements/app";
import { SendWonEmailJob } from "#app/jobs/send-won-email";

export interface CloseLotsJobFields {}

/**
 * Closes every lot past its close time and records the high bidder as the
 * winner. The status guard makes a second run, or two overlapping ones, a
 * no-op for lots already closed.
 */
export class CloseLotsJob extends Job<CloseLotsJobFields> {
  run() {
    tx(() => {
      let closed = sql<{ id: string; winnerId: string | null }>(`
        update lots
           set status = 'closed',
               closedAt = now(),
               winnerId = topBidderId,
               paymentStatus = case when topBidderId is null then 'none' else 'unpaid' end
         where status = 'open'
           and closesAt <= now()
        returning id, winnerId
      `).all();

      for (let lot of closed) {
        if (lot.winnerId) {
          new SendWonEmailJob({ lotId: lot.id }).schedule({ idempotencyKey: `won:${lot.id}` });
        }
      }
    });
  }
}
