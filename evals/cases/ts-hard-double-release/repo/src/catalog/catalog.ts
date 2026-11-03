import { NotFoundError, ValidationError } from "../platform/errors.ts";

export type TaxClass = "standard" | "reduced" | "exempt";

export interface CatalogItem {
  sku: string;
  name: string;
  priceCents: number;
  taxClass: TaxClass;
}

const SKU_PATTERN = /^[A-Z]{2,6}-\d{1,5}$/;

export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

export interface Catalog {
  add(item: CatalogItem): CatalogItem;
  get(sku: string): CatalogItem;
  has(sku: string): boolean;
  list(): CatalogItem[];
  search(text: string): CatalogItem[];
}

export function createCatalog(): Catalog {
  const items = new Map<string, CatalogItem>();

  return {
    add(item) {
      if (!isValidSku(item.sku)) throw new ValidationError(`"${item.sku}" is not a valid SKU (like ABC-123)`);
      if (!Number.isInteger(item.priceCents) || item.priceCents < 0) {
        throw new ValidationError(`${item.sku}: price must be a non-negative number of cents`);
      }
      if (!item.name.trim()) throw new ValidationError(`${item.sku}: name is required`);
      items.set(item.sku, { ...item, name: item.name.trim() });
      return this.get(item.sku);
    },
    get(sku) {
      const item = items.get(sku);
      if (!item) throw new NotFoundError("catalog item", sku);
      return { ...item };
    },
    has(sku) {
      return items.has(sku);
    },
    list() {
      return [...items.values()].map((item) => ({ ...item })).sort((a, b) => a.sku.localeCompare(b.sku));
    },
    search(text) {
      const needle = text.trim().toLowerCase();
      if (!needle) return [];
      return this.list().filter((item) => item.sku.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle));
    },
  };
}
