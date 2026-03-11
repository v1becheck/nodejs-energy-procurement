#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';
import { parseCsvSync, loadPackagesFromFile } from '../src/lib/parser.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL to seed the database.');
  process.exit(1);
}

const baseDir = resolve(process.cwd(), 'sample');
const pricesPath = resolve(baseDir, 'prices.csv');
const demandPath = resolve(baseDir, 'demand.csv');
const packagesPath = resolve(baseDir, 'packages.json');

async function seed(): Promise<void> {
  const priceRows = parseCsvSync(pricesPath);
  const demandRows = parseCsvSync(demandPath);
  const packages = loadPackagesFromFile(packagesPath);

  if (priceRows.length !== demandRows.length) {
    throw new Error('prices and demand row count mismatch');
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('TRUNCATE prices, demand, packages RESTART IDENTITY');

    for (let i = 0; i < priceRows.length; i++) {
      const hourIndex = i;
      const price = parseFloat(priceRows[i].price);
      const demandMWh = parseFloat(demandRows[i].demandMWh);
      const ts = priceRows[i].timestamp ?? '';
      await client.query(
        'INSERT INTO prices (hour_index, timestamp_utc, price) VALUES ($1, $2::timestamptz, $3)',
        [hourIndex, ts || null, price]
      );
      await client.query(
        'INSERT INTO demand (hour_index, timestamp_utc, demand_mwh) VALUES ($1, $2::timestamptz, $3)',
        [hourIndex, ts || null, demandMWh]
      );
    }

    for (const p of packages) {
      await client.query(
        'INSERT INTO packages (duration_hours, max_energy_mwh, fee, discount_percent) VALUES ($1, $2, $3, $4)',
        [p.durationHours, p.maxEnergyMWh, p.fee, p.discountPercent]
      );
    }

    console.log(
      `Seeded ${priceRows.length} price/demand rows and ${packages.length} packages.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
