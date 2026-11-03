export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export function paginate<T>(all: readonly T[], page: number, perPage: number): Page<T> {
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`page must be a positive integer, got ${page}`);
  if (!Number.isInteger(perPage) || perPage < 1) throw new RangeError(`perPage must be a positive integer, got ${perPage}`);
  const totalPages = Math.floor(all.length / perPage);
  const start = (page - 1) * perPage;
  const items = page <= totalPages ? all.slice(start, start + perPage) : [];
  return { items, page, perPage, totalItems: all.length, totalPages, hasNext: page < totalPages };
}
