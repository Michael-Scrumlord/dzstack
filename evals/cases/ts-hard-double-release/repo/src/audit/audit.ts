import type { Clock } from "../platform/clock.ts";
import type { IdGenerator } from "../platform/ids.ts";
import type { EventBus } from "../bus/event-bus.ts";
import type { Store } from "../store/store.ts";

export interface AuditEntry {
  id: string;
  at: number;
  eventId: string;
  type: string;
  summary: string;
}

function summarize(payload: unknown): string {
  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
  }
  return String(payload);
}

/** Writes one audit row per event. It hears everything, including events delivered more than once. */
export function registerAudit(deps: { bus: EventBus; store: Store; clock: Clock; ids: IdGenerator }): void {
  const { bus, store, clock, ids } = deps;
  bus.subscribe("*", "audit.log", async (event) => {
    await store.audit.put({
      id: ids.next("aud"),
      at: clock.now(),
      eventId: event.id,
      type: event.type,
      summary: summarize(event.payload),
    });
  });
}
