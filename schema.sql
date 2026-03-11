-- Energy procurement schema for PostgreSQL
-- Run this to create tables before using the app with DATABASE_URL.

-- Hourly market prices (one row per hour, ordered by hour_index)
CREATE TABLE IF NOT EXISTS prices (
  hour_index INTEGER NOT NULL PRIMARY KEY,
  timestamp_utc TIMESTAMPTZ,
  price NUMERIC(12, 4) NOT NULL CHECK (price >= 0)
);

-- Hourly demand in MWh (same hour_index ordering as prices)
CREATE TABLE IF NOT EXISTS demand (
  hour_index INTEGER NOT NULL PRIMARY KEY,
  timestamp_utc TIMESTAMPTZ,
  demand_mwh NUMERIC(12, 4) NOT NULL CHECK (demand_mwh >= 0)
);

-- Available purchase packages
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  duration_hours INTEGER NOT NULL CHECK (duration_hours >= 1),
  max_energy_mwh NUMERIC(12, 4) NOT NULL CHECK (max_energy_mwh >= 0),
  fee NUMERIC(12, 4) NOT NULL CHECK (fee >= 0),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Optional: index for ordering
CREATE INDEX IF NOT EXISTS idx_prices_hour ON prices (hour_index);
CREATE INDEX IF NOT EXISTS idx_demand_hour ON demand (hour_index);
