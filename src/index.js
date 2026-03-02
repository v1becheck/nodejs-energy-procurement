#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadPricesAndDemand, loadPackages } from './lib/parser.js';
import { optimize } from './lib/optimizer.js';

const DEFAULT_PRICES = 'sample/prices.csv';
const DEFAULT_DEMAND = 'sample/demand.csv';
const DEFAULT_PACKAGES = 'sample/packages.json';

async function main() {
  const baseDir = process.cwd();
  const pricesPath = resolve(baseDir, process.argv[2] || DEFAULT_PRICES);
  const demandPath = resolve(baseDir, process.argv[3] || DEFAULT_DEMAND);
  const packagesPath = resolve(baseDir, process.argv[4] || DEFAULT_PACKAGES);

  if (!existsSync(pricesPath)) {
    console.error(`Error: prices file not found: ${pricesPath}`);
    process.exit(1);
  }
  if (!existsSync(demandPath)) {
    console.error(`Error: demand file not found: ${demandPath}`);
    process.exit(1);
  }
  if (!existsSync(packagesPath)) {
    console.error(`Error: packages file not found: ${packagesPath}`);
    process.exit(1);
  }

  let prices, demand, length;
  try {
    const data = await loadPricesAndDemand(pricesPath, demandPath);
    prices = data.prices;
    demand = data.demand;
    length = data.length;
  } catch (err) {
    console.error('Failed to load prices/demand:', err.message);
    process.exit(1);
  }

  let packages;
  try {
    packages = loadPackages(packagesPath);
  } catch (err) {
    console.error('Failed to load packages:', err.message);
    process.exit(1);
  }

  const result = optimize({ prices, demand, length, packages });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
