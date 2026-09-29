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

export interface LimitPolicy {
  perHour: number;
  perDay: number;
  label: string;
}

export const DECIDE_POLICY: LimitPolicy = { perHour: 10, perDay: 50, label: "decision" };
/** Ratings are far cheaper than a JEV call and blocked only to stop free-text spam. */
export const RATE_POLICY: LimitPolicy = { perHour: 30, perDay: 120, label: "rating" };

export function checkRateLimit(
  ip: string,
  policy: LimitPolicy = DECIDE_POLICY
): { allowed: boolean; reason?: string } {
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
  if (b.hourCount >= policy.perHour) {
    return { allowed: false, reason: `Hourly ${policy.label} limit reached (${policy.perHour}/hour)` };
  }
  if (b.dayCount >= policy.perDay) {
    return { allowed: false, reason: `Daily ${policy.label} limit reached (${policy.perDay}/day)` };
  }
  b.hourCount += 1;
  b.dayCount += 1;
  return { allowed: true };
}
