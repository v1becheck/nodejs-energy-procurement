export interface Package {
  durationHours: number;
  maxEnergyMWh: number;
  fee: number;
  discountPercent: number;
}

export interface OptimizerInput {
  prices: number[];
  demand: number[];
  length: number;
  packages: Package[];
}

export interface PackagePurchased {
  startIndex: number;
  durationHours: number;
  maxEnergyMWh: number;
  fee: number;
  discountPercent: number;
}

export interface OptimizationResult {
  totalCost: number;
  packagesPurchased: PackagePurchased[];
  statistics: {
    totalDemandMWh: number;
    energyCoveredByPackagesMWh: number;
    spotEnergyMWh: number;
    totalFeesPaid: number;
    totalSavings: number;
  };
}
