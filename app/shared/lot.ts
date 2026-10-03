import { SEED_PHOTOS } from "#app/shared/seed-photos";

export interface LotRow {
  id: string;
  number: number;
  title: string;
  description: string;
  startingBid: number;
  increment: number;
  closesAt: Date;
  currentBid: number | null;
  bidCount: number;
  topBidderId: string | null;
  topBidderName: string | null;
  status: "open" | "closed";
  winnerId: string | null;
  winnerName: string | null;
  paymentStatus: "none" | "unpaid" | "paid";
  paidAt: Date | null;
  photos: string[];
  createdAt: Date;
}

export interface BidRow {
  id: string;
  lotId: string;
  userId: string;
  bidderName: string;
  amount: number;
  createdAt: Date;
}

export interface WatchRow {
  id: string;
  lotId: string;
  userId: string;
}

/** A bid in the last two minutes pushes the close back by this much. */
export const EXTEND_WINDOW_MS = 2 * 60_000;

export function minimumBid(lot: Pick<LotRow, "currentBid" | "startingBid" | "increment">): number {
  return lot.currentBid === null ? lot.startingBid : lot.currentBid + lot.increment;
}

/**
 * A photo ref is either `seed:<stem>` for a shipped asset or the `/photos/...`
 * url of an uploaded one.
 */
export function photoUrl(ref: string): string {
  if (ref.startsWith("seed:")) {
    return SEED_PHOTOS[ref.slice(5)] ?? "";
  }

  return ref;
}

export function coverPhoto(lot: LotRow): string {
  return lot.photos.length > 0 ? photoUrl(lot.photos[0]) : "";
}

export function money(amount: number | null): string {
  if (amount === null) {
    return "–";
  }

  return "$" + amount.toLocaleString("en-US");
}

/** Closed means past the close time, whether or not the close job has run. */
export function isClosed(lot: LotRow, now: number): boolean {
  return lot.status === "closed" || +lot.closesAt <= now;
}

export function remainingMs(lot: LotRow, now: number): number {
  return Math.max(0, +lot.closesAt - now);
}

export function isClosingSoon(lot: LotRow, now: number): boolean {
  let left = remainingMs(lot, now);

  return !isClosed(lot, now) && left <= 15 * 60_000;
}

export function countdown(ms: number): string {
  let s = Math.floor(ms / 1000);
  let d = Math.floor(s / 86400);
  let h = Math.floor((s % 86400) / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;

  if (d > 0) {
    return `${d}d ${h}h ${m}m`;
  }

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

export function closeTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The browser's clock, corrected by the server's, so every visitor's
 * countdown reaches zero at the same moment the server stops taking bids.
 */
export interface Clock {
  now: number;
  skew: number;
}

export function startClock(clock: Clock, serverNow: Date) {
  clock.skew = +serverNow - Date.now();
  clock.now = Date.now() + clock.skew;
  setInterval(() => clock.now = Date.now() + clock.skew, 1000);
}
