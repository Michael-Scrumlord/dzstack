import type { Sku } from "./types.ts";

/**
 * The warehouse management system. It is slow on a bad day and sometimes accepts a call and never answers.
 */
export interface WarehousePort {
  /**
   * Tells the warehouse that the units held for a reservation are free again. The warehouse treats a repeated
   * call for the same reservation id as a no-op, so calling it twice is always safe.
   */
  deallocate(reservationId: string, sku: Sku, qty: number): Promise<void>;
}

export const noopWarehouse: WarehousePort = {
  async deallocate() {},
};
