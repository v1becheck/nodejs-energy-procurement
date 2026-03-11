# Energy Procurement Optimization

A Node.js backend (TypeScript + PostgreSQL) that computes the minimum-cost mix of **spot** and **package** electricity purchases to meet hourly demand over a time horizon.

**Stack:** Node.js 18+, TypeScript, PostgreSQL (required).

## Quick start

**Without PostgreSQL (file-based, sample data):**

```bash
npm install
npm run build
npm start
```

Uses `sample/prices.csv`, `sample/demand.csv`, and `sample/packages.json` by default. Output is JSON to stdout.

**With PostgreSQL:**

1. Create a database and set the connection string:

   ```bash
   # Windows
   set DATABASE_URL=postgresql://user:password@localhost:5432/energy
   # Unix/macOS
   export DATABASE_URL=postgresql://user:password@localhost:5432/energy
   ```

2. Create tables (run the schema once):

   ```bash
   # Windows
   psql %DATABASE_URL% -f schema.sql
   # Unix/macOS
   psql "$DATABASE_URL" -f schema.sql
   ```

3. Seed with sample data (optional):

   ```bash
   npm run db:seed
   ```

4. Run the app:

   ```bash
   npm run build
   npm start
   ```

With `DATABASE_URL` set, the app loads prices, demand, and packages from PostgreSQL instead of files.

**Import the task's input files into PostgreSQL** (after schema is applied):

```bash
# Default: prices.csv demand.csv packages.json in cwd
npm run db:import

# Or pass paths (relative to cwd)
npm run db:import -- path/to/prices.csv path/to/demand.csv path/to/packages.json
```

## Testing with PostgreSQL (local setup)

### Option A: PostgreSQL installed locally (Windows)

1. **Install PostgreSQL**  
   Download and install from [postgresql.org](https://www.postgresql.org/download/windows/). During setup, note the password you set for the `postgres` user.

2. **Create a database**  
   Open a shell (PowerShell or cmd) and run (adjust password if needed):

   ```powershell
   psql -U postgres -c "CREATE DATABASE energy;"
   ```
   If `psql` is not on your PATH, use the full path, e.g.  
   `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE energy;"`

3. **Set the connection string** (replace `yourpassword` with your postgres password):

   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:yourpassword@localhost:5432/energy"
   ```

4. **Create tables** (from the project root):

   ```powershell
   psql -U postgres -d energy -f schema.sql
   ```
   Or with full path to `psql` if needed.

5. **Seed sample data**:

   ```powershell
   npm run db:seed
   ```

6. **Run the app**:

   ```powershell
   npm run build
   npm start
   ```

   You should see the same JSON output as when using files. To use the DB again in a new terminal, set `DATABASE_URL` again (step 3).

### Option B: PostgreSQL with Docker

If you have Docker:

```powershell
docker run -d --name energy-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

Then create the database and set the URL:

```powershell
# Wait a few seconds for Postgres to start, then:
docker exec -it energy-pg psql -U postgres -c "CREATE DATABASE energy;"

$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/energy"
```

From the project root, run the schema and seed:

```powershell
# Load schema (PowerShell)
Get-Content schema.sql | docker exec -i energy-pg psql -U postgres -d energy

npm run db:seed
npm run build
npm start
```

To stop the container later: `docker stop energy-pg`

## Development

Run without building (TypeScript via tsx):

```bash
npm run dev
```

To use your own CSV/JSON files when not using PostgreSQL:

```bash
node dist/index.js path/to/prices.csv path/to/demand.csv path/to/packages.json
```

## PostgreSQL schema

Tables used when `DATABASE_URL` is set:

| Table     | Description |
|----------|-------------|
| `prices` | `hour_index` (PK), `timestamp_utc`, `price` |
| `demand` | `hour_index` (PK), `timestamp_utc`, `demand_mwh` |
| `packages` | `duration_hours`, `max_energy_mwh`, `fee`, `discount_percent` |

Run `schema.sql` against your database before seeding or loading data. Hour indices must match between `prices` and `demand` (0-based, contiguous).

## Output

JSON with:

- **totalCost** – minimum total cost
- **packagesPurchased** – chosen packages (startIndex, durationHours, maxEnergyMWh, fee, discountPercent)
- **statistics** – totalDemandMWh, energyCoveredByPackagesMWh, spotEnergyMWh, totalFeesPaid, totalSavings

## Approach

1. **Data loading**  
   From **PostgreSQL**: query `prices`, `demand`, and `packages` ordered by `hour_index`.  
   From **files**: streaming CSV parser for large price/demand files; JSON for packages.

2. **Optimization (greedy)**  
   - **Candidates**: For each package type, sample a bounded number of start times. For each (package, start), compute the best allocation of `maxEnergyMWh` to hours in the window (highest spot-price first). Value = discount savings − fee.  
   - **Scaling**: Caps on package types and start times (`MAX_PACKAGE_TYPES`, `MAX_STARTS_PER_PACKAGE` in `src/lib/optimizer.ts`).  
   - **Selection**: Sort candidates by value (desc), then greedily add placements; recompute allocation against remaining demand. Remaining demand is met with spot.  
   - **Cost**: Total = spot cost + package fees + discounted package energy cost.

3. **Correctness**  
   Demand is fully met every hour; package use respects `maxEnergyMWh` and time window. Greedy strategy is scalable but not guaranteed globally optimal.

## Project layout

```
src/
  index.ts         # CLI: loads from DB or files, runs optimizer, prints JSON
  lib/
    types.ts       # Shared TypeScript types
    parser.ts      # CSV/JSON file parsing
    db.ts          # PostgreSQL client, load prices/demand/packages
    optimizer.ts   # Greedy package selection and cost computation
schema.sql         # PostgreSQL DDL
scripts/
  seed-db.ts       # Seed DB from sample/ CSVs and JSON
sample/            # Sample input files (CSV + JSON)
```

## Task requirements (from spec)

| Requirement | Status |
|-------------|--------|
| Node.js program | ✅ TypeScript, runs with Node |
| Load and parse input | ✅ From files (CSV/JSON) or from PostgreSQL |
| Compute optimal purchasing strategy | ✅ Greedy optimizer (candidates + selection) |
| Output format (totalCost, packagesPurchased, statistics) | ✅ Exact JSON shape |
| Correct and efficient for large inputs | ✅ Streaming CSVs; caps for 500k rows / 1M packages |
| **Stack: PostgreSQL + TypeScript** | ✅ Schema, DB client, load from DB; full TS codebase |
| Instructions to run | ✅ This README |
| Brief explanation of approach | ✅ Approach section above |

**Bonus (optional):** Benchmarks and design/optimization notes are not implemented; the README documents the approach and scaling choices.

## Requirements

- **Node.js** 18+
- **TypeScript** (build step or `tsx` for dev)
- **PostgreSQL** when using database (set `DATABASE_URL`)
