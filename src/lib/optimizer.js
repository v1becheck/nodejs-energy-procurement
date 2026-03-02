/**
 * Energy procurement optimizer.
 * Finds minimum cost mix of spot purchases and package purchases.
 * Uses a greedy strategy: rank package placements by potential savings, then add them one by one.
 */

const MAX_PACKAGE_TYPES = 10000;   // cap to keep candidate count manageable
const MAX_STARTS_PER_PACKAGE = 500; // sampled start times per package type

/**
 * Compute the best allocation of package energy in window [start, start+duration):
 * allocate maxEnergyMWh to the hours with highest spot price (up to demandAtHour[h] each).
 * demandAtHour can be the full demand or remaining demand when reusing.
 * Returns { savingsFromDiscount, allocation[] } where allocation[h] = MWh from this package at hour h.
 */
function bestAllocationInWindow(prices, demandAtHour, start, duration, maxEnergyMWh, discountPercent) {
  const end = Math.min(start + duration, prices.length);
  const hours = [];
  for (let h = start; h < end; h++) {
    hours.push({ index: h, price: prices[h], demand: demandAtHour[h] });
  }
  hours.sort((a, b) => b.price - a.price); // descending by price
  let budget = maxEnergyMWh;
  const allocation = new Array(prices.length).fill(0);
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

/**
 * Build list of candidate package placements: (package, start, potential savings, allocation helper).
 * We sample package types and start times to scale to large inputs.
 */
function buildCandidates(prices, demand, packages) {
  const H = prices.length;
  const candidates = [];
  const packageList = packages.length > MAX_PACKAGE_TYPES
    ? packages.slice(0, MAX_PACKAGE_TYPES)
    : packages;

  for (let pi = 0; pi < packageList.length; pi++) {
    const pkg = packageList[pi];
    const { durationHours, maxEnergyMWh, fee, discountPercent } = pkg;
    if (durationHours > H) continue;
    const maxStart = H - durationHours;
    const step = Math.max(1, Math.floor((maxStart + 1) / MAX_STARTS_PER_PACKAGE));
    for (let start = 0; start <= maxStart; start += step) {
      const { savingsFromDiscount } = bestAllocationInWindow(
        prices, demand, start, durationHours, maxEnergyMWh, discountPercent
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

/**
 * Greedily select package placements and allocate energy.
 * remainingDemand is mutated; returns list of purchased placements with their allocations.
 */
function selectPackages(candidates, prices, demand) {
  const H = prices.length;
  const remainingDemand = demand.slice();
  const purchased = [];

  for (const c of candidates) {
    const { allocation } = bestAllocationInWindow(
      prices, remainingDemand, c.start, c.durationHours, c.maxEnergyMWh, c.discountPercent
    );
    const end = Math.min(c.start + c.durationHours, H);
    let totalAlloc = 0;
    let costWithDiscount = 0;
    const actualAlloc = new Array(H).fill(0);
    for (let h = c.start; h < end; h++) {
      const take = allocation[h];
      actualAlloc[h] = take;
      totalAlloc += take;
      costWithDiscount += take * prices[h] * (1 - c.discountPercent / 100);
    }
    const savings = totalAlloc > 0
      ? actualAlloc.reduce((s, a, h) => s + a * prices[h], 0) * (c.discountPercent / 100) - c.fee
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

/**
 * Compute total cost and statistics.
 */
function computeResult(prices, demand, purchased, remainingDemand) {
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
 * Run optimization. Input: { prices, demand, packages }.
 * Returns result object matching the required output format.
 */
export function optimize(input) {
  const { prices, demand, length: H } = input;
  const packages = input.packages || [];
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
