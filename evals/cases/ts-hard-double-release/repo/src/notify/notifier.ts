import type { EventBus } from "../bus/event-bus.ts";
import { EVENT, type OrderEventPayload } from "../bus/events.ts";
import { render } from "./templates.ts";

export interface Message {
  to: string;
  subject: string;
  body: string;
  eventId: string;
}

export interface Notifier {
  /** Messages queued for the mail relay, oldest first. */
  readonly outbox: Message[];
}

/** Queues a customer email for order status changes. The mail relay drops messages it has already sent. */
export function createNotifier(bus: EventBus): Notifier {
  const outbox: Message[] = [];
  for (const type of [EVENT.orderConfirmed, EVENT.orderCancelled, EVENT.orderExpired]) {
    bus.subscribe(type, `notify.${type}`, async (event) => {
      const payload = event.payload as OrderEventPayload;
      if (!payload.customerId) return;
      const { subject, body } = render(event.type, payload);
      outbox.push({ to: payload.customerId, subject, body, eventId: event.id });
    });
  }
  return { outbox };
}
