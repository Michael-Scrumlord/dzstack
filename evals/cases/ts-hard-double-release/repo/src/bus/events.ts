// The events the service publishes, and the payload each one carries.

export const EVENT = {
  orderPlaced: "order.placed",
  orderConfirmed: "order.confirmed",
  orderCancelled: "order.cancelled",
  orderExpired: "order.expired",
  reservationExpired: "reservation.expired",
  reservationReleased: "reservation.released",
} as const;

export interface BusEvent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  occurredAt: number;
}

export interface OrderEventPayload {
  orderId: string;
  customerId?: string;
}

export interface ReservationExpiredPayload {
  reservationId: string;
  orderId: string;
}

export interface ReservationReleasedPayload {
  reservationId: string;
  orderId: string;
  sku: string;
  qty: number;
  reason: string;
}
