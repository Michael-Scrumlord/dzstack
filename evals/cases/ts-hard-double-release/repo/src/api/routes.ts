import { DomainError } from "../platform/errors.ts";
import type { Catalog } from "../catalog/catalog.ts";
import type { Config } from "../config.ts";
import type { Ledger } from "../inventory/ledger.ts";
import type { Reconciler } from "../inventory/reconcile.ts";
import type { OrderService } from "../orders/orders.ts";
import type { PlaceOrderInput } from "../orders/types.ts";
import { buildStockReport, problems, renderStockReport } from "../reports/stock-report.ts";
import { createRouter, type HttpResponse, type RouteHandler, type Router } from "./router.ts";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  validation: 400,
  insufficient_stock: 409,
  invalid_transition: 409,
  reservation_expired: 409,
};

/** Turns a domain error into the response the client should see; anything else stays a 500. */
function guarded(handler: RouteHandler): RouteHandler {
  return async (req, params) => {
    try {
      return await handler(req, params);
    } catch (error) {
      if (error instanceof DomainError) {
        return { status: STATUS_BY_CODE[error.code] ?? 400, body: { error: error.code, message: error.message } };
      }
      return { status: 500, body: { error: "internal" } };
    }
  };
}

const ok = (body: unknown, status = 200): HttpResponse => ({ status, body });

export function createApi(deps: {
  orders: OrderService;
  ledger: Ledger;
  catalog: Catalog;
  reconciler: Reconciler;
  config: Config;
}): Router {
  const { orders, ledger, catalog, reconciler, config } = deps;
  const router = createRouter();

  router.add("POST", "/orders", guarded(async (req) => ok(await orders.place(req.body as PlaceOrderInput), 201)));

  router.add(
    "GET",
    "/orders/:id",
    guarded(async (_req, { id }) => {
      const order = await orders.get(id);
      return order ? ok(order) : { status: 404, body: { error: "not_found", message: `order ${id} not found` } };
    }),
  );

  router.add("POST", "/orders/:id/confirm", guarded(async (_req, { id }) => ok(await orders.confirm(id))));
  router.add("POST", "/orders/:id/cancel", guarded(async (_req, { id }) => ok(await orders.cancel(id))));

  router.add("GET", "/stock", guarded(async (req) => {
    const rows = buildStockReport(ledger.all(), catalog, config.lowStockThreshold);
    if (req.query?.format === "text") return ok(renderStockReport(rows));
    return ok({ rows, problems: problems(rows).map((r) => r.sku) });
  }));

  router.add("GET", "/stock/:sku", guarded(async (_req, { sku }) => ok(ledger.snapshot(sku))));
  router.add("POST", "/admin/reconcile", guarded(async () => ok(await reconciler.run())));

  return router;
}
