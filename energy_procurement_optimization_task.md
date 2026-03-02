# Energy Procurement Optimization Task

## Overview

You are building a backend service for a large industrial customer that purchases electricity on a time‑varying market. The customer consumes electricity continuously, and the price of electricity changes every hour.

In addition to buying electricity directly at the current market price ("spot" purchase), the customer can also purchase special contracts ("packages") that cover a continuous time interval. Each package offers a discounted rate but comes with its own constraints and fees.

Your goal is to determine the most cost‑effective purchasing strategy over the entire time horizon.

This task simulates a real‑world large‑scale data processing and optimization problem.

---

## Input Data

You are given three input files:

### 1. prices.csv

Hourly electricity market prices.

Format:

```
timestamp,price
2025-01-01T00:00:00Z,87.12
2025-01-01T01:00:00Z,91.43
...
```

Constraints:

- Number of rows: up to 500,000
- price ≥ 0

---

### 2. demand.csv

Hourly electricity consumption.

Format:

```
timestamp,demandMWh
2025-01-01T00:00:00Z,12.4
2025-01-01T01:00:00Z,11.8
...
```

Constraints:

- Same timestamps and ordering as prices.csv
- demandMWh ≥ 0

---

### 3. packages.json

List of available purchase packages.

Format:

```json
[
  {
    "durationHours": 24,
    "maxEnergyMWh": 100,
    "fee": 35.0,
    "discountPercent": 12.5
  },
  {
    "durationHours": 8,
    "maxEnergyMWh": 30,
    "fee": 8.0,
    "discountPercent": 20.0
  }
]
```

Constraints:

- Number of packages: up to 1,000,000
- durationHours ≥ 1
- maxEnergyMWh ≥ 0
- fee ≥ 0
- discountPercent between 0 and 100

Each package may be purchased starting at any hour, as long as the full duration fits within the available timeline.

---

## Rules

At each hour, the customer's energy demand must be fully satisfied.

Energy can be obtained via:

1. Spot purchase
   - Pay full market price for each MWh consumed at that hour

2. Package purchase
   - A package covers a continuous block of hours
   - Within that block, you may allocate up to maxEnergyMWh total
   - Any energy allocated through the package receives the discountPercent reduction from the spot price
   - The package fee must be paid regardless of usage

Important notes:

- Energy covered by a package must fall within its time interval
- Each package has its own independent energy limit
- Demand not covered by packages must be purchased at spot price
- Multiple packages may overlap in time
- You may choose any number of packages, including none

---

## Objective

Compute the minimum possible total cost to satisfy all demand across the entire timeline.

Total cost consists of:

- Spot purchases
- Package purchases
- Package fees

---

## Output

Your program must output:

```json
{
  "totalCost": 12345678.90,
  "packagesPurchased": [
    {
      "startIndex": 120,
      "durationHours": 24,
      "maxEnergyMWh": 100,
      "fee": 35.0,
      "discountPercent": 12.5
    }
  ],
  "statistics": {
    "totalDemandMWh": 987654.32,
    "energyCoveredByPackagesMWh": 543210.98,
    "spotEnergyMWh": 444443.34,
    "totalFeesPaid": 12345.67,
    "totalSavings": 765432.10
  }
}
```

---

## Performance Requirements

Your solution must be able to handle large datasets efficiently.

Target constraints:

- prices.csv and demand.csv up to 500,000 rows
- packages.json up to 1,000,000 entries
- Execution time should scale reasonably with input size
- Memory usage should be appropriate for a backend service

You may assume the program runs in a Node.js environment.

---

## Requirements

Implement a Node.js program that:

- Loads and parses the input files
- Computes the optimal purchasing strategy
- Produces the required output format

The solution should be correct and efficient for large inputs.

---

## Notes

This problem involves:

- Processing large datasets
- Making globally optimal decisions across a time‑dependent sequence
- Handling overlapping time intervals and constrained resource allocation
- Careful performance considerations

---

## Bonus (Optional)

- Provide benchmarks for different input sizes
- Document your design decisions
- Explain any optimizations used to improve performance

---

## Deliverables

Submit:

- Source code
- Instructions to run
- Brief explanation of your approach

The program should run using a standard Node.js runtime.

