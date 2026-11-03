// The service never reads the system clock or starts a real timer itself: everything asks a Clock,
// so tests (and the staging replay tool) can drive time by hand.

export type TimerHandle = unknown;

export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  /** Runs fn once, ms from now. The handle goes to clearTimeout. */
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

/** Timers are unref'd: the HTTP server keeps the process alive, a pending expiry timer must not. */
export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
