// MVP rate limiting: in-memory per-IP sliding counters.
// Fine for a single local/dev instance; swap for the Firestore-backed counter
// from plan.md §7.4 before production.

interface Bucket {
  hourStart: number;
  hourCount: number;
  dayStart: number;
  dayCount: number;
}

const buckets = new Map<string, Bucket>();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_PER_HOUR = 10;
const MAX_PER_DAY = 50;

export function checkRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
    buckets.set(ip, b);
  }
  if (now - b.hourStart > HOUR) {
    b.hourStart = now;
    b.hourCount = 0;
  }
  if (now - b.dayStart > DAY) {
    b.dayStart = now;
    b.dayCount = 0;
  }
  if (b.hourCount >= MAX_PER_HOUR) return { allowed: false, reason: "Hourly limit reached (10/hour)" };
  if (b.dayCount >= MAX_PER_DAY) return { allowed: false, reason: "Daily limit reached (50/day)" };
  b.hourCount += 1;
  b.dayCount += 1;
  return { allowed: true };
}
