import { readFileSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { Package } from './types.js';

/**
 * Parse a CSV file with header. Returns array of rows as objects keyed by column name.
 */
export function parseCsvSync(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((col, j) => (row[col] = values[j]));
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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
export async function* parseCsvStream(filePath: string): AsyncGenerator<Record<string, string>> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of rl) {
    const values = parseCsvLine(line);
    if (!header) {
      header = values.map((h) => h.trim());
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((col, j) => (row[col] = values[j]));
    yield row;
  }
}

export interface PricesAndDemand {
  prices: number[];
  demand: number[];
  length: number;
}

/**
 * Load prices and demand from CSV files (streaming for large files).
 */
export async function loadPricesAndDemand(
  pricesPath: string,
  demandPath: string
): Promise<PricesAndDemand> {
  const prices: number[] = [];
  const demand: number[] = [];
  const priceStream = parseCsvStream(pricesPath);
  const demandStream = parseCsvStream(demandPath);
  const priceIterator = priceStream[Symbol.asyncIterator]();
  const demandIterator = demandStream[Symbol.asyncIterator]();
  while (true) {
    const [p, d] = await Promise.all([priceIterator.next(), demandIterator.next()]);
    if (p.done || d.done) break;
    const price = parseFloat((p.value as Record<string, string>).price);
    const demandMWh = parseFloat((d.value as Record<string, string>).demandMWh);
    if (Number.isNaN(price) || price < 0)
      throw new Error(`Invalid price at row: ${JSON.stringify(p.value)}`);
    if (Number.isNaN(demandMWh) || demandMWh < 0)
      throw new Error(`Invalid demand at row: ${JSON.stringify(d.value)}`);
    prices.push(price);
    demand.push(demandMWh);
  }
  return { prices, demand, length: prices.length };
}

/**
 * Load and validate packages from JSON file.
 */
export function loadPackagesFromFile(filePath: string): Package[] {
  const content = readFileSync(filePath, 'utf-8');
  const data: unknown = JSON.parse(content);
  if (!Array.isArray(data)) throw new Error('packages.json must be an array');
  return data.map((p: Record<string, unknown>, i: number) => {
    const durationHours = parseInt(String(p.durationHours), 10);
    const maxEnergyMWh = parseFloat(String(p.maxEnergyMWh));
    const fee = parseFloat(String(p.fee));
    const discountPercent = parseFloat(String(p.discountPercent));
    if (Number.isNaN(durationHours) || durationHours < 1)
      throw new Error(`Package ${i}: invalid durationHours`);
    if (Number.isNaN(maxEnergyMWh) || maxEnergyMWh < 0)
      throw new Error(`Package ${i}: invalid maxEnergyMWh`);
    if (Number.isNaN(fee) || fee < 0) throw new Error(`Package ${i}: invalid fee`);
    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)
      throw new Error(`Package ${i}: invalid discountPercent`);
    return { durationHours, maxEnergyMWh, fee, discountPercent };
  });
}
