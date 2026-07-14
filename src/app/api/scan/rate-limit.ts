/**
 * 60 scans a minute per host (docs/API_SPEC.md §rate limits). The queue at the
 * gate is the reason the budget is this high: a limiter that throttles a real
 * queue of 200 people is a limiter that closes the barrier.
 */
export const SCAN_RATE_LIMIT = { limit: 60, windowSeconds: 60 } as const;
