#!/usr/bin/env node

/**
 * Import the task's three input files (prices.csv, demand.csv, packages.json) into PostgreSQL.
 * Usage: npm run db:import -- prices.csv demand.csv packages.json
 * Or:    npx tsx scripts/import-files-to-db.ts prices.csv demand.csv packages.json
 * Requires DATABASE_URL. Tables must exist (run schema.sql first).
 */

import { resolve } from 'path';
import pg from 'pg';
import { parseCsvSync, loadPackagesFromFile } from '../src/lib/parser.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL to import into the database.');
  process.exit(1);
}

const baseDir = process.cwd();
const pricesPath = resolve(baseDir, process.argv[2] ?? 'prices.csv');
const demandPath = resolve(baseDir, process.argv[3] ?? 'demand.csv');
const packagesPath = resolve(baseDir, process.argv[4] ?? 'packages.json');

async function run(): Promise<void> {
  const priceRows = parseCsvSync(pricesPath);
  const demandRows = parseCsvSync(demandPath);
  const packages = loadPackagesFromFile(packagesPath);

  if (priceRows.length !== demandRows.length) {
    throw new Error(
      `Row count mismatch: prices ${priceRows.length}, demand ${demandRows.length}`
    );
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('TRUNCATE prices, demand, packages RESTART IDENTITY');

    for (let i = 0; i < priceRows.length; i++) {
      const hourIndex = i;
      const price = parseFloat(priceRows[i].price);
      const demandMWh = parseFloat(demandRows[i].demandMWh);
      const ts = priceRows[i].timestamp ?? null;
      await client.query(
        'INSERT INTO prices (hour_index, timestamp_utc, price) VALUES ($1, $2::timestamptz, $3)',
        [hourIndex, ts, price]
      );
      await client.query(
        'INSERT INTO demand (hour_index, timestamp_utc, demand_mwh) VALUES ($1, $2::timestamptz, $3)',
        [hourIndex, ts, demandMWh]
      );
    }

    for (const p of packages) {
      await client.query(
        'INSERT INTO packages (duration_hours, max_energy_mwh, fee, discount_percent) VALUES ($1, $2, $3, $4)',
        [p.durationHours, p.maxEnergyMWh, p.fee, p.discountPercent]
      );
    }

    console.log(
      `Imported ${priceRows.length} price/demand rows and ${packages.length} packages.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
