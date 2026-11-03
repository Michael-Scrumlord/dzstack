export type Sku = string;

/**
 * active: holds stock for an order that has not been paid or cancelled yet.
 * committed: the order was confirmed; the units count as sold.
 * released: the units went back to available (order cancelled, reservation expired, or reconcile).
 */
export type ReservationStatus = "active" | "committed" | "released";

export type ReleaseReason = "order_cancelled" | "expired" | "reconcile";

export interface Reservation {
  id: string;
  orderId: string;
  sku: Sku;
  qty: number;
  status: ReservationStatus;
  createdAt: number;
  expiresAt: number;
  committedAt?: number;
  releasedAt?: number;
  releaseReason?: ReleaseReason;
}

export interface StockCounts {
  sku: Sku;
  /** Units physically in the warehouse. */
  onHand: number;
  /** Units that can still be reserved. */
  available: number;
  /** Units held by active reservations. */
  reserved: number;
  /** Units of confirmed orders. */
  sold: number;
}
