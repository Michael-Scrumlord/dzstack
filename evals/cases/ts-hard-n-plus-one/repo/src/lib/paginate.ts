export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export function pageMeta(total: number, page: number, perPage: number): PageMeta {
  const totalPages = Math.ceil(total / perPage);
  return { page, perPage, total, totalPages, hasNext: page < totalPages };
}

export function paginate<T>(all: readonly T[], page: number, perPage: number): { items: T[] } & PageMeta {
  const start = (page - 1) * perPage;
  return { items: all.slice(start, start + perPage), ...pageMeta(all.length, page, perPage) };
}
