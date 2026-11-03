import type { Clock } from "../platform/clock.ts";
import type { IdGenerator } from "../platform/ids.ts";
import type { Logger } from "../platform/logger.ts";
import type { BusEvent } from "./events.ts";
import type { Transport } from "./transport.ts";

export type Handler = (event: BusEvent) => Promise<void>;

export interface DeadLetter {
  subscriber: string;
  event: BusEvent;
  error: unknown;
}

export interface EventBus {
  /** `type` may be "*" to hear everything. `name` identifies the subscriber in logs and in the dead-letter list. */
  subscribe(type: string, name: string, handler: Handler): void;
  /** Creates the event and hands one job per matching subscriber to the transport. Returns at once. */
  publish<T>(type: string, payload: T): BusEvent<T>;
  readonly deadLetters: DeadLetter[];
}

interface Subscription {
  type: string;
  name: string;
  handler: Handler;
}

export function createEventBus(deps: { transport: Transport; clock: Clock; ids: IdGenerator; logger: Logger }): EventBus {
  const { transport, clock, ids, logger } = deps;
  const subscriptions: Subscription[] = [];
  const deadLetters: DeadLetter[] = [];

  return {
    deadLetters,
    subscribe(type, name, handler) {
      subscriptions.push({ type, name, handler });
    },
    publish(type, payload) {
      const event = { id: ids.next("evt"), type, payload, occurredAt: clock.now() };
      for (const sub of subscriptions) {
        if (sub.type !== "*" && sub.type !== type) continue;
        transport.enqueue({
          subscriber: sub.name,
          event,
          async run() {
            try {
              await sub.handler(event);
            } catch (error) {
              deadLetters.push({ subscriber: sub.name, event, error });
              logger.error("delivery failed", { subscriber: sub.name, event: event.id, type: event.type });
            }
          },
        });
      }
      return event;
    },
  };
}
