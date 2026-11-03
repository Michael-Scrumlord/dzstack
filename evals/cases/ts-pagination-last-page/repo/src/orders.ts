import { paginate, type Page } from "./paginate.ts";

export interface Order {
  id: number;
  customer: string;
  totalCents: number;
}

export function listOrders(orders: readonly Order[], query: { page?: string; perPage?: string }): Page<Order> {
  const page = query.page === undefined ? 1 : Number(query.page);
  const perPage = query.perPage === undefined ? 20 : Math.min(Number(query.perPage), 100);
  return paginate(orders, page, perPage);
}
