import type { Package, OptimizerInput, OptimizationResult } from './types.js';

const MAX_PACKAGE_TYPES = 10000;
const MAX_STARTS_PER_PACKAGE = 500;

function bestAllocationInWindow(
  prices: number[],
  demandAtHour: number[],
  start: number,
  duration: number,
  maxEnergyMWh: number,
  discountPercent: number
): { savingsFromDiscount: number; allocation: number[] } {
  const end = Math.min(start + duration, prices.length);
  const hours: { index: number; price: number; demand: number }[] = [];
  for (let h = start; h < end; h++) {
    hours.push({ index: h, price: prices[h], demand: demandAtHour[h] });
  }
  hours.sort((a, b) => b.price - a.price);
  let budget = maxEnergyMWh;
  const allocation = new Array(prices.length).fill(0) as number[];
  let savingsFromDiscount = 0;
  for (const { index, price, demand: d } of hours) {
    if (budget <= 0) break;
    const alloc = Math.min(d, budget);
    allocation[index] = alloc;
    budget -= alloc;
    savingsFromDiscount += alloc * price * (discountPercent / 100);
  }
  return { savingsFromDiscount, allocation };
}

interface Candidate {
  package: Package;
  start: number;
  fee: number;
  discountPercent: number;
  netValue: number;
  durationHours: number;
  maxEnergyMWh: number;
}

function buildCandidates(
  prices: number[],
  demand: number[],
  packages: Package[]
): Candidate[] {
  const H = prices.length;
  const candidates: Candidate[] = [];
  const packageList =
    packages.length > MAX_PACKAGE_TYPES ? packages.slice(0, MAX_PACKAGE_TYPES) : packages;

  for (const pkg of packageList) {
    const { durationHours, maxEnergyMWh, fee, discountPercent } = pkg;
    if (durationHours > H) continue;
    const maxStart = H - durationHours;
    const step = Math.max(1, Math.floor((maxStart + 1) / MAX_STARTS_PER_PACKAGE));
    for (let start = 0; start <= maxStart; start += step) {
      const { savingsFromDiscount } = bestAllocationInWindow(
        prices,
        demand,
        start,
        durationHours,
        maxEnergyMWh,
        discountPercent
      );
      const netValue = savingsFromDiscount - fee;
      if (netValue <= 0) continue;
      candidates.push({
        package: pkg,
        start,
        fee,
        discountPercent,
        netValue,
        durationHours,
        maxEnergyMWh,
      });
    }
  }
  candidates.sort((a, b) => b.netValue - a.netValue);
  return candidates;
}

interface Purchased {
  startIndex: number;
  durationHours: number;
  maxEnergyMWh: number;
  fee: number;
  discountPercent: number;
  allocation: number[];
  energyUsed: number;
  costWithDiscount: number;
}

function selectPackages(
  candidates: Candidate[],
  prices: number[],
  demand: number[]
): { purchased: Purchased[]; remainingDemand: number[] } {
  const H = prices.length;
  const remainingDemand = demand.slice();
  const purchased: Purchased[] = [];

  for (const c of candidates) {
    const { allocation } = bestAllocationInWindow(
      prices,
      remainingDemand,
      c.start,
      c.durationHours,
      c.maxEnergyMWh,
      c.discountPercent
    );
    const end = Math.min(c.start + c.durationHours, H);
    let totalAlloc = 0;
    let costWithDiscount = 0;
    const actualAlloc = new Array(H).fill(0) as number[];
    for (let h = c.start; h < end; h++) {
      const take = allocation[h];
      actualAlloc[h] = take;
      totalAlloc += take;
      costWithDiscount += take * prices[h] * (1 - c.discountPercent / 100);
    }
    const savings =
      totalAlloc > 0
        ? actualAlloc.reduce((s, a, h) => s + a * prices[h], 0) * (c.discountPercent / 100) -
          c.fee
        : -c.fee;
    if (totalAlloc === 0 || savings <= 0) continue;
    purchased.push({
      startIndex: c.start,
      durationHours: c.durationHours,
      maxEnergyMWh: c.maxEnergyMWh,
      fee: c.fee,
      discountPercent: c.discountPercent,
      allocation: actualAlloc,
      energyUsed: totalAlloc,
      costWithDiscount,
    });
    for (let h = 0; h < H; h++) remainingDemand[h] -= actualAlloc[h];
  }

  return { purchased, remainingDemand };
}

function computeResult(
  prices: number[],
  demand: number[],
  purchased: Purchased[],
  remainingDemand: number[]
) {
  const H = prices.length;
  let spotCost = 0;
  let totalDemandMWh = 0;
  for (let h = 0; h < H; h++) {
    spotCost += remainingDemand[h] * prices[h];
    totalDemandMWh += demand[h];
  }
  let totalFeesPaid = 0;
  let packageEnergyCost = 0;
  let energyCoveredByPackagesMWh = 0;
  for (const p of purchased) {
    totalFeesPaid += p.fee;
    packageEnergyCost += p.costWithDiscount;
    energyCoveredByPackagesMWh += p.energyUsed;
  }
  const spotEnergyMWh = remainingDemand.reduce((a, b) => a + b, 0);
  const totalCost = spotCost + totalFeesPaid + packageEnergyCost;
  const costWithoutPackages = demand.reduce((s, d, h) => s + d * prices[h], 0);
  const totalSavings = costWithoutPackages - totalCost;
  return {
    totalCost,
    totalDemandMWh,
    energyCoveredByPackagesMWh,
    spotEnergyMWh,
    totalFeesPaid,
    totalSavings,
    purchased,
  };
}

/**
 * Run optimization. Returns result matching the required output format.
 */
export function optimize(input: OptimizerInput): OptimizationResult {
  const { prices, demand, length: H } = input;
  const packages = input.packages ?? [];
  if (H === 0) {
    return {
      totalCost: 0,
      packagesPurchased: [],
      statistics: {
        totalDemandMWh: 0,
        energyCoveredByPackagesMWh: 0,
        spotEnergyMWh: 0,
        totalFeesPaid: 0,
        totalSavings: 0,
      },
    };
  }
  const candidates = buildCandidates(prices, demand, packages);
  const { purchased, remainingDemand } = selectPackages(candidates, prices, demand);
  const result = computeResult(prices, demand, purchased, remainingDemand);
  return {
    totalCost: Math.round(result.totalCost * 100) / 100,
    packagesPurchased: result.purchased.map((p) => ({
      startIndex: p.startIndex,
      durationHours: p.durationHours,
      maxEnergyMWh: p.maxEnergyMWh,
      fee: p.fee,
      discountPercent: p.discountPercent,
    })),
    statistics: {
      totalDemandMWh: Math.round(result.totalDemandMWh * 100) / 100,
      energyCoveredByPackagesMWh: Math.round(result.energyCoveredByPackagesMWh * 100) / 100,
      spotEnergyMWh: Math.round(result.spotEnergyMWh * 100) / 100,
      totalFeesPaid: Math.round(result.totalFeesPaid * 100) / 100,
      totalSavings: Math.round(result.totalSavings * 100) / 100,
    },
  };
}
