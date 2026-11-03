export type OrderStatus = "pending" | "confirmed" | "cancelled" | "expired";

export interface OrderLine {
  sku: string;
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  reservationId: string;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  lines: OrderLine[];
  totalCents: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlaceOrderInput {
  customerId: string;
  lines: Array<{ sku: string; qty: number }>;
}
