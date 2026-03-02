# Energy Procurement Optimization

A Node.js backend that computes the minimum-cost mix of **spot** and **package** electricity purchases to meet hourly demand over a time horizon.

## Requirements

- **Node.js 18+**

## How to run

From the project root:

```bash
npm start
```

This uses the sample data in `sample/` by default. To use your own files, pass paths as arguments:

```bash
node src/index.js prices.csv demand.csv packages.json
```

Input paths are relative to the current working directory. Output is written to **stdout** as JSON.

## Input files

| File           | Description                    |
|----------------|--------------------------------|
| `prices.csv`   | Hourly market price (timestamp, price) |
| `demand.csv`   | Hourly consumption (timestamp, demandMWh) |
| `packages.json`| Array of purchase packages (durationHours, maxEnergyMWh, fee, discountPercent) |

See `energy_procurement_optimization_task.md` for exact formats and constraints.

## Output

JSON with:

- **totalCost** – minimum total cost
- **packagesPurchased** – list of chosen packages (startIndex, durationHours, maxEnergyMWh, fee, discountPercent)
- **statistics** – totalDemandMWh, energyCoveredByPackagesMWh, spotEnergyMWh, totalFeesPaid, totalSavings

## Approach

1. **Data loading**  
   Prices and demand are read with a **streaming** CSV parser so that large files (e.g. 500k rows) stay within reasonable memory.

2. **Optimization (greedy)**  
   - **Candidates**: For each package type, sample a bounded number of start times over the horizon. For each (package, start), compute the best allocation of the package’s `maxEnergyMWh` to hours in its window by filling **highest spot-price hours first** (up to demand). Value = discount savings − fee.  
   - **Scaling**: Package types and start times are capped (`MAX_PACKAGE_TYPES`, `MAX_STARTS_PER_PACKAGE` in `src/lib/optimizer.js`) so that candidate count stays manageable for large inputs.  
   - **Selection**: Candidates are sorted by this value (descending). We then greedily add placements: for each candidate, we recompute the best allocation against **current remaining demand**. If net savings (discount − fee) is positive, we add the package and subtract its allocation from remaining demand; otherwise we skip.  
   - **Cost**: Remaining demand is met with spot; total cost = spot cost + package fees + discounted package energy cost.

3. **Correctness**  
   At every hour, demand is fully met; package usage never exceeds `maxEnergyMWh` per package or the package time window. The greedy strategy does not guarantee a global optimum but gives a good, scalable solution for large datasets.

## Project layout

```
src/
  index.js       # CLI entry, loads data and runs optimizer
  lib/
    parser.js    # CSV/JSON parsing (streaming for large CSVs)
    optimizer.js # Greedy package selection and cost computation
```

## Sample data

Sample input files are in `sample/`:

```bash
node src/index.js sample/prices.csv sample/demand.csv sample/packages.json
```

Or copy them to the project root and run `npm start`.
