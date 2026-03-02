import { readFileSync } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Parse a CSV file with header. Returns array of rows as objects keyed by column name.
 * For large files (e.g. 500k rows), use parseCsvStream.
 */
export function parseCsvSync(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((col, j) => (row[col] = values[j]));
    rows.push(row);
  }
  return rows;
}

/**
 * Parse one CSV line handling quoted fields.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Stream-based CSV parser for large files. Yields rows as objects.
 */
export async function* parseCsvStream(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    const values = parseCsvLine(line);
    if (!header) {
      header = values.map((h) => h.trim());
      continue;
    }
    const row = {};
    header.forEach((col, j) => (row[col] = values[j]));
    yield row;
  }
}

/**
 * Load prices.csv and demand.csv and return { prices: number[], demand: number[], length }.
 * Uses streaming for large files to limit memory.
 */
export async function loadPricesAndDemand(pricesPath, demandPath) {
  const prices = [];
  const demand = [];
  const priceStream = parseCsvStream(pricesPath);
  const demandStream = parseCsvStream(demandPath);
  const priceIterator = priceStream[Symbol.asyncIterator]();
  const demandIterator = demandStream[Symbol.asyncIterator]();
  while (true) {
    const [p, d] = await Promise.all([priceIterator.next(), demandIterator.next()]);
    if (p.done || d.done) break;
    const price = parseFloat(p.value.price);
    const demandMWh = parseFloat(d.value.demandMWh);
    if (Number.isNaN(price) || price < 0) throw new Error(`Invalid price at row: ${JSON.stringify(p.value)}`);
    if (Number.isNaN(demandMWh) || demandMWh < 0) throw new Error(`Invalid demand at row: ${JSON.stringify(d.value)}`);
    prices.push(price);
    demand.push(demandMWh);
  }
  return { prices, demand, length: prices.length };
}

/**
 * Load prices and demand using sync parsing (for smaller files or when stream not needed).
 */
export function loadPricesAndDemandSync(pricesPath, demandPath) {
  const priceRows = parseCsvSync(pricesPath);
  const demandRows = parseCsvSync(demandPath);
  if (priceRows.length !== demandRows.length) {
    throw new Error(`Mismatch: prices has ${priceRows.length} rows, demand has ${demandRows.length}`);
  }
  const prices = priceRows.map((r) => {
    const p = parseFloat(r.price);
    if (Number.isNaN(p) || p < 0) throw new Error(`Invalid price: ${r.price}`);
    return p;
  });
  const demand = demandRows.map((r) => {
    const d = parseFloat(r.demandMWh);
    if (Number.isNaN(d) || d < 0) throw new Error(`Invalid demand: ${r.demandMWh}`);
    return d;
  });
  return { prices, demand, length: prices.length };
}

/**
 * Load and validate packages.json.
 */
export function loadPackages(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  if (!Array.isArray(data)) throw new Error('packages.json must be an array');
  return data.map((p, i) => {
    const durationHours = parseInt(p.durationHours, 10);
    const maxEnergyMWh = parseFloat(p.maxEnergyMWh);
    const fee = parseFloat(p.fee);
    const discountPercent = parseFloat(p.discountPercent);
    if (Number.isNaN(durationHours) || durationHours < 1) throw new Error(`Package ${i}: invalid durationHours`);
    if (Number.isNaN(maxEnergyMWh) || maxEnergyMWh < 0) throw new Error(`Package ${i}: invalid maxEnergyMWh`);
    if (Number.isNaN(fee) || fee < 0) throw new Error(`Package ${i}: invalid fee`);
    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error(`Package ${i}: invalid discountPercent`);
    return {
      durationHours,
      maxEnergyMWh,
      fee,
      discountPercent,
    };
  });
}
