export interface Config {
  /** How long a reservation holds stock before it expires. */
  reservationTtlMs: number;
  /** Delivery retries for event handlers that call slow systems. */
  retry: { attempts: number; timeoutMs: number; backoffMs: number };
  /** Stock below this many available units is flagged LOW in the stock report. */
  lowStockThreshold: number;
  /** Tax rate in basis points (2000 = 20 %). */
  taxBasisPoints: number;
}

export const defaultConfig: Config = {
  reservationTtlMs: 15 * 60 * 1000,
  retry: { attempts: 3, timeoutMs: 5000, backoffMs: 1000 },
  lowStockThreshold: 5,
  taxBasisPoints: 2000,
};

export type ConfigOverrides = {
  [K in keyof Config]?: Config[K] extends object ? Partial<Config[K]> : Config[K];
};

export function resolveConfig(overrides: ConfigOverrides = {}): Config {
  return {
    ...defaultConfig,
    ...overrides,
    retry: { ...defaultConfig.retry, ...overrides.retry },
  };
}

function int(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${value}"`);
  return n;
}

/** Reads STOCKROOM_* variables; anything not set keeps its default. */
export function configFromEnv(env: Record<string, string | undefined>): Config {
  return resolveConfig({
    reservationTtlMs: int(env.STOCKROOM_RESERVATION_TTL_MS, defaultConfig.reservationTtlMs, "STOCKROOM_RESERVATION_TTL_MS"),
    retry: {
      attempts: int(env.STOCKROOM_RETRY_ATTEMPTS, defaultConfig.retry.attempts, "STOCKROOM_RETRY_ATTEMPTS"),
      timeoutMs: int(env.STOCKROOM_RETRY_TIMEOUT_MS, defaultConfig.retry.timeoutMs, "STOCKROOM_RETRY_TIMEOUT_MS"),
      backoffMs: int(env.STOCKROOM_RETRY_BACKOFF_MS, defaultConfig.retry.backoffMs, "STOCKROOM_RETRY_BACKOFF_MS"),
    },
    lowStockThreshold: int(env.STOCKROOM_LOW_STOCK, defaultConfig.lowStockThreshold, "STOCKROOM_LOW_STOCK"),
    taxBasisPoints: int(env.STOCKROOM_TAX_BP, defaultConfig.taxBasisPoints, "STOCKROOM_TAX_BP"),
  });
}
