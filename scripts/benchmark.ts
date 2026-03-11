#!/usr/bin/env node

/**
 * Benchmarks the optimizer at different input sizes.
 * Usage: npm run benchmark
 * Optional: BENCHMARK_HOURS=1000,50000 BENCHMARK_PACKAGES=10,100 node ...
 */

import { optimize } from '../src/lib/optimizer.js';
import type { Package } from '../src/lib/types.js';

function generatePricesAndDemand(hours: number): { prices: number[]; demand: number[] } {
  const prices: number[] = [];
  const demand: number[] = [];
  for (let h = 0; h < hours; h++) {
    const hourOfDay = h % 24;
    const price = 60 + 40 * Math.sin((hourOfDay - 6) * (Math.PI / 12)) + Math.random() * 20;
    prices.push(Math.max(0, Math.round(price * 100) / 100));
    demand.push(Math.max(1, Math.round((10 + 8 * Math.sin((hourOfDay - 8) * (Math.PI / 12)) + Math.random() * 4) * 100) / 100));
  }
  return { prices, demand };
}

function generatePackages(count: number): Package[] {
  const packages: Package[] = [];
  const durations = [8, 12, 24, 48];
  for (let i = 0; i < count; i++) {
    packages.push({
      durationHours: durations[i % durations.length],
      maxEnergyMWh: 20 + Math.floor(Math.random() * 80),
      fee: 5 + Math.floor(Math.random() * 45),
      discountPercent: 5 + Math.random() * 25,
    });
  }
  return packages;
}

function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runBenchmark(hours: number, numPackages: number): { optimizeMs: number; totalCost: number } {
  const { prices, demand } = generatePricesAndDemand(hours);
  const packages = generatePackages(numPackages);
  let totalCost = 0;
  const optimizeMs = measureMs(() => {
    const result = optimize({ prices, demand, length: hours, packages });
    totalCost = result.totalCost;
  });
  return { optimizeMs, totalCost };
}

function main(): void {
  const hoursList = parseList(process.env.BENCHMARK_HOURS ?? '100,1000,5000,10000,25000', (s) =>
    parseInt(s, 10)
  );
  const packagesList = parseList(process.env.BENCHMARK_PACKAGES ?? '10,50,100,500', (s) =>
    parseInt(s, 10)
  );

  console.log('Energy Procurement Optimizer – Benchmarks\n');
  console.log('Input sizes: hours =', hoursList.join(', '), '| packages =', packagesList.join(', '));
  console.log('');

  const rows: { hours: number; packages: number; optimizeMs: number; totalCost: number }[] = [];

  for (const numPackages of packagesList) {
    for (const hours of hoursList) {
      process.stdout.write(`  hours=${hours}, packages=${numPackages} ... `);
      const { optimizeMs, totalCost } = runBenchmark(hours, numPackages);
      rows.push({ hours, packages: numPackages, optimizeMs, totalCost });
      console.log(formatMs(optimizeMs));
    }
  }

  console.log('\n--- Summary (optimize time) ---\n');
  printTable(hoursList, packagesList, rows);
  console.log('\nDone.');
}

function parseList<T>(env: string, parse: (s: string) => T): T[] {
  return env.split(',').map((s) => parse(s.trim())).filter((x) => !Number.isNaN(x as number));
}

function printTable(
  hoursList: number[],
  packagesList: number[],
  rows: { hours: number; packages: number; optimizeMs: number; totalCost: number }[]
): void {
  const get = (h: number, p: number) =>
    rows.find((r) => r.hours === h && r.packages === p)?.optimizeMs ?? 0;

  const maxW = (n: number) => n.toString().length;
  const hoursW = Math.max(6, ...hoursList.map((h) => maxW(h)));
  const packW = Math.max(8, ...packagesList.map((p) => maxW(p)));
  const cellW = 10;

  const pad = (s: string, w: number) => s.padStart(w);
  const head = pad('hours \\ pkgs', packW) + ' | ' + hoursList.map((h) => pad(String(h), cellW)).join(' | ');
  const sep = '-'.repeat(head.length);

  console.log(head);
  console.log(sep);

  for (const p of packagesList) {
    const cells = hoursList.map((h) => pad(formatMs(get(h, p)), cellW));
    console.log(pad(String(p), packW) + ' | ' + cells.join(' | '));
  }
}

main();
