import type { Order } from "../orders/types.ts";
import type { Reservation } from "../inventory/types.ts";
import type { AuditEntry } from "../audit/audit.ts";
import { createMemoryCollection, type Collection } from "./collection.ts";

export interface Store {
  orders: Collection<Order>;
  reservations: Collection<Reservation>;
  audit: Collection<AuditEntry>;
}

export function createMemoryStore(): Store {
  return {
    orders: createMemoryCollection<Order>(),
    reservations: createMemoryCollection<Reservation>(),
    audit: createMemoryCollection<AuditEntry>(),
  };
}
