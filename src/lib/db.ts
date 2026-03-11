import pg from 'pg';
import type { Package } from './types.js';

const { Pool } = pg;

export interface PricesAndDemand {
  prices: number[];
  demand: number[];
  length: number;
}

/**
 * Load prices and demand from PostgreSQL. Tables must have hour_index and price/demand_mwh.
 */
export async function loadPricesAndDemandFromDb(
  pool: pg.Pool
): Promise<PricesAndDemand> {
  const client = await pool.connect();
  try {
    const [pricesResult, demandResult] = await Promise.all([
      client.query<{ hour_index: number; price: number }>(
        'SELECT hour_index, price FROM prices ORDER BY hour_index'
      ),
      client.query<{ hour_index: number; demand_mwh: number }>(
        'SELECT hour_index, demand_mwh FROM demand ORDER BY hour_index'
      ),
    ]);
    const prices = pricesResult.rows.map((r) => Number(r.price));
    const demand = demandResult.rows.map((r) => Number(r.demand_mwh));
    if (prices.length !== demand.length) {
      throw new Error(
        `Mismatch: prices has ${prices.length} rows, demand has ${demand.length}`
      );
    }
    return { prices, demand, length: prices.length };
  } finally {
    client.release();
  }
}

/**
 * Load packages from PostgreSQL.
 */
export async function loadPackagesFromDb(pool: pg.Pool): Promise<Package[]> {
  const result = await pool.query<{
    duration_hours: number;
    max_energy_mwh: number;
    fee: number;
    discount_percent: number;
  }>('SELECT duration_hours, max_energy_mwh, fee, discount_percent FROM packages');
  return result.rows.map((r) => ({
    durationHours: Number(r.duration_hours),
    maxEnergyMWh: Number(r.max_energy_mwh),
    fee: Number(r.fee),
    discountPercent: Number(r.discount_percent),
  }));
}

/**
 * Create a connection pool from DATABASE_URL.
 */
export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for PostgreSQL');
  }
  return new Pool({ connectionString });
}
