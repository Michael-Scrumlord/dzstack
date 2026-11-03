import { createApi } from "./api/routes.ts";
import type { Router } from "./api/router.ts";
import { registerAudit } from "./audit/audit.ts";
import { createEventBus, type EventBus } from "./bus/event-bus.ts";
import { createInMemoryTransport, type Transport } from "./bus/transport.ts";
import { createCatalog, type Catalog } from "./catalog/catalog.ts";
import { resolveConfig, type Config, type ConfigOverrides } from "./config.ts";
import { registerInventoryHandlers } from "./inventory/handlers.ts";
import { createLedger, type Ledger } from "./inventory/ledger.ts";
import { createReconciler, type Reconciler } from "./inventory/reconcile.ts";
import { createReservationService, type ReservationService } from "./inventory/reservations.ts";
import { noopWarehouse, type WarehousePort } from "./inventory/warehouse.ts";
import { createNotifier, type Notifier } from "./notify/notifier.ts";
import { createOrderService, type OrderService } from "./orders/orders.ts";
import { systemClock, type Clock } from "./platform/clock.ts";
import { createIdGenerator } from "./platform/ids.ts";
import { createMemoryLogger, type Logger } from "./platform/logger.ts";
import { createMemoryStore, type Store } from "./store/store.ts";

export interface AppDeps {
  clock?: Clock;
  transport?: Transport;
  warehouse?: WarehousePort;
  store?: Store;
  logger?: Logger;
  config?: ConfigOverrides;
}

export interface App {
  config: Config;
  catalog: Catalog;
  ledger: Ledger;
  store: Store;
  bus: EventBus;
  reservations: ReservationService;
  orders: OrderService;
  reconciler: Reconciler;
  notifier: Notifier;
  api: Router;
}

/** Wires the service together. Every outside dependency can be replaced; the defaults are for tests and local runs. */
export function createApp(deps: AppDeps = {}): App {
  const clock = deps.clock ?? systemClock;
  const config = resolveConfig(deps.config);
  const logger = deps.logger ?? createMemoryLogger();
  const store = deps.store ?? createMemoryStore();
  const ids = createIdGenerator();
  const bus = createEventBus({ transport: deps.transport ?? createInMemoryTransport(), clock, ids, logger });
  const catalog = createCatalog();
  const ledger = createLedger();

  const reservations = createReservationService({
    store,
    ledger,
    bus,
    warehouse: deps.warehouse ?? noopWarehouse,
    clock,
    ids,
    config,
  });
  const orders = createOrderService({ store, catalog, reservations, bus, clock, ids, config });
  registerInventoryHandlers({ bus, reservations, orders, clock, config });
  registerAudit({ bus, store, clock, ids });
  const notifier = createNotifier(bus);
  const reconciler = createReconciler({ reservations, orders, ledger, clock, logger });
  const api = createApi({ orders, ledger, catalog, reconciler, config });

  return { config, catalog, ledger, store, bus, reservations, orders, reconciler, notifier, api };
}
