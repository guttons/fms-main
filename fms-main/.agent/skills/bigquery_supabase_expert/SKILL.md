---
name: BigQuery and Supabase Schema Expert
description: Guidelines, schemas, and procedures for managing PostgreSQL/Supabase migrations and Google BigQuery table operations.
---

# BigQuery & Supabase Data Architecture Guide

This skill documents the schema specifications, integration patterns, and migration guidelines for the dual-database architecture of MACL FMS:
1. **Supabase (PostgreSQL)**: Transactional data (Finance modules, Vessel schedules, Equipment states).
2. **BigQuery**: High-throughput operational logs (Flight fueling logs, filling station records).

---

## 1. Supabase Database Guidelines

### Schema Conventions
- All table names for specific modules must be prefixed:
  - Finance: `fin_` (e.g., `fin_customers`, `fin_invoices`, `fin_fuel_requests`).
  - Vessel/Calibration: prefix accordingly.
- Primary keys should generally be `TEXT` types mapped to clean UUIDs or domain IDs.
- Numerical financial data must use `NUMERIC` to avoid precision issues.

### Migration Guidelines
- Migration scripts should be saved in SQL files in the project root (e.g., [finance_migration.sql](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/finance_migration.sql)).
- Always use `CREATE TABLE IF NOT EXISTS` to ensure scripts are idempotent.
- Explicitly configure Row Level Security (RLS) per table according to deployment policies.

---

## 2. BigQuery Data Specifications

### Tables & Datasets
- **Dataset ID**: `fms_data`
- **Core Tables**:
  - `operations_log`: Telemetry logs of flight and seaplane fueling operations.
  - `filling_station_log`: Loading logs for Fueling Stations (LFS / AFS).
  - `refueler_loading_log`: Telemetry for refueler tanks loading.

### Proxy Integration Architecture
Because frontend clients do not interact directly with BigQuery, all queries go through a Cloud Run API proxy ([api/src/index.ts](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/api/src/index.ts)).
- **Auth Flow**: Frontend retrieves JWT session tokens via `supabase.auth.getSession()` and adds it as `Authorization: Bearer <token>` to request headers.
- **Batch Inserts**: Use chunks of **500 rows** when performing bulk inserts to respect Google BigQuery API limits and quotas.
- **Schema Migration**: Local BigQuery API bootstrap routine automatically runs table update migrations. If migrations fail due to quota rate-limits, execute non-blocking, non-fatal fallbacks.

---

## 3. Client & TypeScript Mappings

- All schema models must have matching TypeScript types in [types.ts](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/types.ts).
- Database interface utilities must reside inside [services/supabaseService.ts](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/services/supabaseService.ts).
- BigQuery requests must route through `_bqBase()` and `_bqAuthHeaders()` helpers inside the service module.
