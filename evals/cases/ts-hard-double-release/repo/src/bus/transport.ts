import type { BusEvent } from "./events.ts";

/** One event on its way to one subscriber. `run()` may be called more than once: delivery is at least once. */
export interface DeliveryJob {
  subscriber: string;
  event: BusEvent;
  run(): Promise<void>;
}

/**
 * How jobs get executed. In production this is a queue consumer; the in-memory transport below runs each job
 * on the next microtask. A transport may run a job again (a redelivery) and may run jobs at the same time.
 */
export interface Transport {
  enqueue(job: DeliveryJob): void;
}

export function createInMemoryTransport(): Transport {
  return {
    enqueue(job) {
      queueMicrotask(() => {
        void job.run();
      });
    },
  };
}
