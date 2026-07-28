import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { BigQuery, TableSchema } from '@google-cloud/bigquery';
import crypto from 'crypto';

// ─── BigQuery client ─────────────────────────────────────────────────────────
const bigquery = new BigQuery({ projectId: 'macl-fms-496808' });

const DATASET_ID  = 'fms_data';
const TABLE_ID    = 'operations_log';
const FILLING_STATION_TABLE_ID = 'filling_station_log';
const REFUELER_LOADING_TABLE_ID = 'refueler_loading_log';

const PROJECT_ID  = 'macl-fms-496808';
const TABLE_REF   = `\`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``;
const FILLING_STATION_TABLE_REF = `\`${PROJECT_ID}.${DATASET_ID}.${FILLING_STATION_TABLE_ID}\``;
const REFUELER_LOADING_TABLE_REF = `\`${PROJECT_ID}.${DATASET_ID}.${REFUELER_LOADING_TABLE_ID}\``;

// ─── filling_station_log schema ──────────────────────────────────────────────
const FILLING_STATION_SCHEMA: TableSchema = {
  fields: [
    { name: 'id',             type: 'STRING',    mode: 'REQUIRED' },
    { name: 'station',        type: 'STRING',    mode: 'REQUIRED' }, // 'LFS' | 'AFS'
    { name: 'fuel_type',      type: 'STRING',    mode: 'REQUIRED' }, // 'Diesel' | 'Petrol' | 'Lube Oil' | 'Internal'
    { name: 'date',           type: 'DATE',      mode: 'REQUIRED' },
    { name: 'invoice_number', type: 'STRING',    mode: 'NULLABLE' },
    { name: 'vehicle_reg',    type: 'STRING',    mode: 'REQUIRED' },
    { name: 'driver_name',    type: 'STRING',    mode: 'NULLABLE' },
    { name: 'volume',         type: 'FLOAT64',   mode: 'REQUIRED' },
    { name: 'payment_mode',   type: 'STRING',    mode: 'NULLABLE' },
    { name: 'received_by',    type: 'STRING',    mode: 'NULLABLE' },
    { name: 'equipment_name', type: 'STRING',    mode: 'NULLABLE' },
    { name: 'operator_id',    type: 'STRING',    mode: 'NULLABLE' },
    { name: 'remarks',        type: 'STRING',    mode: 'NULLABLE' },
    { name: 'is_deleted',     type: 'BOOL',      mode: 'NULLABLE' },
    { name: 'created_at',     type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'updated_at',     type: 'TIMESTAMP', mode: 'NULLABLE' },
  ],
};

// ─── refueler_loading_log schema ─────────────────────────────────────────────
const REFUELER_LOADING_SCHEMA: TableSchema = {
  fields: [
    { name: 'id',                  type: 'STRING',    mode: 'REQUIRED' },
    { name: 'source_tank_id',      type: 'STRING',    mode: 'REQUIRED' },
    { name: 'vehicle_id',          type: 'STRING',    mode: 'REQUIRED' },
    { name: 'volume',              type: 'FLOAT64',   mode: 'REQUIRED' },
    { name: 'start_time',          type: 'STRING',    mode: 'NULLABLE' },
    { name: 'end_time',            type: 'STRING',    mode: 'NULLABLE' },
    { name: 'date',                type: 'DATE',      mode: 'REQUIRED' },
    { name: 'visual_check_passed', type: 'BOOL',      mode: 'REQUIRED' },
    { name: 'cwd_check_passed',    type: 'BOOL',      mode: 'REQUIRED' },
    { name: 'density',             type: 'FLOAT64',   mode: 'NULLABLE' },
    { name: 'temperature',         type: 'FLOAT64',   mode: 'NULLABLE' },
    { name: 'operator_name',       type: 'STRING',    mode: 'NULLABLE' },
    { name: 'supervisor_name',     type: 'STRING',    mode: 'NULLABLE' },
    { name: 'is_deleted',          type: 'BOOL',      mode: 'NULLABLE' },
    { name: 'created_at',          type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'updated_at',          type: 'TIMESTAMP', mode: 'NULLABLE' },
  ],
};

// ─── operations_log schema ───────────────────────────────────────────────────
const OPERATIONS_LOG_SCHEMA: TableSchema = {
  fields: [
    { name: 'id',                   type: 'STRING',    mode: 'REQUIRED' },
    { name: 'log_type',             type: 'STRING',    mode: 'REQUIRED'  }, // 'FLIGHT' | 'SEAPLANE'
    { name: 'flight_number',        type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'aircraft_reg',         type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'aircraft_type',        type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'stand',                type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'operator_id',          type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'vehicle_id',           type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'status',               type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'delivery_number',      type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'meter_open',           type: 'FLOAT64',   mode: 'NULLABLE'  },
    { name: 'meter_close',          type: 'FLOAT64',   mode: 'NULLABLE'  },
    { name: 'volume',               type: 'FLOAT64',   mode: 'NULLABLE'  },
    { name: 'panel_check',          type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'walk_around_check',    type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'appearance_check',     type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'water_check',          type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'timestamp_arrived',    type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_position',   type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_start',      type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_initial_end',type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_final_start',type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_final_end',  type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_clearance',  type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'remarks',              type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'tactical_operator',    type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'route',                type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'co',                   type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'is_domestic',          type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'int_dom',              type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'airline',              type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'operational_date',     type: 'DATE',      mode: 'NULLABLE'  },
    { name: 'pit_number',           type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'is_adhoc',             type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'psi',                  type: 'FLOAT64',   mode: 'NULLABLE'  },
    { name: 'lpm',                  type: 'FLOAT64',   mode: 'NULLABLE'  },
    { name: 'officer',              type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'operator_name',        type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'destination',          type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'payment_type',         type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'is_deleted',           type: 'BOOL',      mode: 'NULLABLE'  },
    { name: 'created_at',           type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'updated_at',           type: 'TIMESTAMP', mode: 'NULLABLE'  },
  ],
};

// ─── Ensure dataset + table exist ────────────────────────────────────────────
async function ensureSchema(): Promise<void> {
  // Dataset
  const dataset = bigquery.dataset(DATASET_ID);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await dataset.create({ location: 'US' });
    console.log(`[BigQuery] Created dataset: ${DATASET_ID}`);
  }

  // Table
  const table = dataset.table(TABLE_ID);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(TABLE_ID, { schema: OPERATIONS_LOG_SCHEMA });
    console.log(`[BigQuery] Created table: ${DATASET_ID}.${TABLE_ID}`);
  } else {
    try {
      const columnsToAdd = [
        'route STRING',
        'co STRING',
        'is_domestic BOOL',
        'int_dom STRING',
        'airline STRING',
        'operational_date DATE',
        'pit_number STRING',
        'is_adhoc BOOL',
        'timestamp_final_start TIMESTAMP',
        'psi FLOAT64',
        'lpm FLOAT64',
        'officer STRING',
        'operator_name STRING',
        'destination STRING',
        'payment_type STRING',
      ];
      const addClauses = columnsToAdd.map(col => `ADD COLUMN IF NOT EXISTS ${col}`).join(', ');
      const alterSql = `ALTER TABLE ${TABLE_REF} ${addClauses}`;
      console.log(`[BigQuery] Schema migration: ${alterSql}`);
      await bigquery.query({ query: alterSql, location: 'US' });
    } catch (e: any) {
      console.error('[BigQuery] Migration failed:', e.message);
    }
  }

  // New Table: filling_station_log
  const fsTable = dataset.table(FILLING_STATION_TABLE_ID);
  const [fsTableExists] = await fsTable.exists();
  if (!fsTableExists) {
    await dataset.createTable(FILLING_STATION_TABLE_ID, { schema: FILLING_STATION_SCHEMA });
    console.log(`[BigQuery] Created table: ${DATASET_ID}.${FILLING_STATION_TABLE_ID}`);
  }

  // New Table: refueler_loading_log
  const rlTable = dataset.table(REFUELER_LOADING_TABLE_ID);
  const [rlTableExists] = await rlTable.exists();
  if (!rlTableExists) {
    await dataset.createTable(REFUELER_LOADING_TABLE_ID, { schema: REFUELER_LOADING_SCHEMA });
    console.log(`[BigQuery] Created table: ${DATASET_ID}.${REFUELER_LOADING_TABLE_ID}`);
  }
}

// ─── Row mappers ─────────────────────────────────────────────────────────────
function cleanBigQueryRow(row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val && typeof val === 'object' && 'value' in val) {
      cleaned[key] = val.value;
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

function rowToLog(row: Record<string, any>) {
  const ts = (v: any) => v?.value ?? v ?? null;
  const dt = (v: any) => v?.value ?? v ?? null;
  return {
    id:                  row.id,
    logType:             row.log_type,
    flightNumber:        row.flight_number,
    aircraftReg:         row.aircraft_reg,
    aircraftType:        row.aircraft_type,
    stand:               row.stand,
    operatorId:          row.operator_id,
    vehicleId:           row.vehicle_id,
    status:              row.status,
    deliveryNumber:      row.delivery_number,
    meterOpen:           row.meter_open,
    meterClose:          row.meter_close,
    volume:              row.volume,
    panelCheck:          row.panel_check,
    walkAroundCheck:     row.walk_around_check,
    appearanceCheck:     row.appearance_check,
    waterCheck:          row.water_check,
    timestampArrived:    ts(row.timestamp_arrived),
    timestampPosition:   ts(row.timestamp_position),
    timestampStart:      ts(row.timestamp_start),
    timestampInitialEnd: ts(row.timestamp_initial_end),
    timestampFinalStart: ts(row.timestamp_final_start),
    timestampFinalEnd:   ts(row.timestamp_final_end),
    timestampClearance:  ts(row.timestamp_clearance),
    remarks:             row.remarks,
    tacticalOperator:    row.tactical_operator,
    route:               row.route,
    co:                  row.co,
    isDomestic:          row.is_domestic,
    intDom:              row.INT_DOM || row.int_dom || null,
    airline:             row.airline,
    operationalDate:     dt(row.operational_date),
    pitNumber:           row.pit_number,
    isAdhoc:             row.is_adhoc,
    psi:                 row.psi,
    lpm:                 row.lpm,
    officer:             row.officer,
    operatorName:        row.operator_name,
    destination:         row.destination,
    paymentType:         row.payment_type,
  };
}

function logToRow(log: Record<string, any>, id: string): Record<string, any> {
  const now = new Date().toISOString();
  const isSeaplane = (log.flightNumber ?? '').startsWith('SEAPLANE');
  return {
    id,
    log_type:              log.logType ?? (isSeaplane ? 'SEAPLANE' : 'FLIGHT'),
    flight_number:         log.flightNumber   ?? null,
    aircraft_reg:          log.aircraftReg    ?? null,
    aircraft_type:         log.aircraftType   ?? null,
    stand:                 log.stand          ?? null,
    operator_id:           log.operatorId     ?? null,
    vehicle_id:            log.vehicleId      ?? null,
    status:                log.status         ?? 'COMPLETED',
    delivery_number:       log.deliveryNumber ?? null,
    meter_open:            log.meterOpen      ?? null,
    meter_close:           log.meterClose     ?? null,
    volume:                log.volume         ?? null,
    panel_check:           log.panelCheck     ?? null,
    walk_around_check:     log.walkAroundCheck    ?? null,
    appearance_check:      log.appearanceCheck    ?? null,
    water_check:           log.waterCheck         ?? null,
    timestamp_arrived:     log.timestampArrived   ?? null,
    timestamp_position:    log.timestampPosition  ?? null,
    timestamp_start:       log.timestampStart     ?? null,
    timestamp_initial_end: log.timestampInitialEnd ?? null,
    timestamp_final_start: log.timestampFinalStart ?? null,
    timestamp_final_end:   log.timestampFinalEnd  ?? null,
    timestamp_clearance:   log.timestampClearance ?? null,
    remarks:               log.remarks             ?? null,
    tactical_operator:     log.tacticalOperator    ?? null,
    route:                 log.route               ?? null,
    co:                    log.co                  ?? null,
    is_domestic:           log.isDomestic          ?? null,
    int_dom:               log.intDom || (log.logType === 'SEAPLANE' ? 'SEA' : (log.isDomestic ? 'DOM' : 'INT')),
    airline:               log.airline             ?? null,
    operational_date:      log.operationalDate     ?? null,
    pit_number:            log.pitNumber           ?? null,
    is_adhoc:              log.isAdhoc             ?? null,
    psi:                   log.psi                 ?? null,
    lpm:                   log.lpm                 ?? null,
    officer:               log.officer             ?? null,
    operator_name:         log.operatorName        ?? null,
    destination:           log.destination         ?? null,
    payment_type:          log.paymentType         ?? null,
    is_deleted:            false,
    created_at:            now,
    updated_at:            now,
  };
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://macl-fms.web.app',
  'https://macl-fms.firebaseapp.com',
  'https://macl-fms.netlify.app',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
];

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// ─── Auth middleware ──────────────────────────────────────────────────────────
interface Jwk {
  kty: string;
  use?: string;
  crv?: string;
  kid: string;
  x?: string;
  y?: string;
  alg?: string;
  n?: string;
  e?: string;
}

let jwksCache: {
  keys: Jwk[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

async function getJwks(projectRef: string): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && (now - jwksCache.fetchedAt < CACHE_TTL)) {
    return jwksCache.keys;
  }

  const url = `https://${projectRef}.supabase.co/auth/v1/.well-known/jwks.json`;
  console.log(`[Auth] Fetching JWKS from ${url}`);
  
  const headers: Record<string, string> = {};
  if (process.env.SUPABASE_ANON_KEY) {
    headers['apikey'] = process.env.SUPABASE_ANON_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { keys: Jwk[] };
  if (!data.keys || !Array.isArray(data.keys)) {
    throw new Error('Invalid JWKS response structure');
  }

  jwksCache = {
    keys: data.keys,
    fetchedAt: now
  };
  return data.keys;
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    // 1. Decode token to inspect alg and kid in the header
    const decodedToken = jwt.decode(idToken, { complete: true }) as {
      header: { alg: string; kid?: string; [key: string]: any };
      payload: { iss?: string; ref?: string; [key: string]: any };
    } | null;

    if (!decodedToken || !decodedToken.header) {
      res.status(401).json({ error: 'Unauthorized: invalid or malformed JWT token structure.' });
      return;
    }

    const { alg, kid } = decodedToken.header;
    let decodedUser: any;

    if (alg === 'ES256') {
      if (!kid) {
        res.status(401).json({ error: 'Unauthorized: missing "kid" header in ES256 token.' });
        return;
      }

      // Resolve the project reference
      let projectRef = process.env.SUPABASE_PROJECT_REF || 'pzyrstehoesmhwkhtoxd';
      const payload = decodedToken.payload;
      if (payload) {
        if (payload.ref) {
          projectRef = payload.ref;
        } else if (typeof payload.iss === 'string' && payload.iss.includes('.supabase.co')) {
          const match = payload.iss.match(/https:\/\/([^.]+)\.supabase\.co/);
          if (match && match[1]) {
            projectRef = match[1];
          }
        }
      }

      // Fetch JWKS
      const keys = await getJwks(projectRef);
      const jwk = keys.find(k => k.kid && k.kid.toLowerCase() === kid.toLowerCase());
      if (!jwk) {
        res.status(401).json({ error: `Unauthorized: no matching public key found in JWKS for kid "${kid}".` });
        return;
      }

      // Convert JWK to PEM public key using native crypto
      const publicKey = crypto.createPublicKey({
        key: jwk as any,
        format: 'jwk'
      });
      const pem = publicKey.export({ type: 'spki', format: 'pem' });

      // Verify the token using the public key
      decodedUser = jwt.verify(idToken, pem, { algorithms: ['ES256'] });
    } else {
      // Fallback: HS256 verification (standard symmetric secret verification)
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (!jwtSecret) {
        console.error('[Auth] SUPABASE_JWT_SECRET environment variable is not set!');
        res.status(500).json({ error: 'Internal Server Error: Auth configuration missing.' });
        return;
      }
      
      try {
        const base64Secret = Buffer.from(jwtSecret, 'base64');
        decodedUser = jwt.verify(idToken, base64Secret, { algorithms: ['HS256'] });
      } catch (err) {
        try {
          decodedUser = jwt.verify(idToken, jwtSecret, { algorithms: ['HS256'] });
        } catch (err2) {
          console.error('[Auth] HS256 Token verification failed with both base64 and raw secret:', err2);
          throw err2;
        }
      }
    }

    (req as any).user = decodedUser;
    next();
  } catch (err: any) {
    console.error('[Auth] Token verification failed:', err);
    res.status(401).json({ 
      error: 'Unauthorized: invalid Supabase ID token.',
      message: err.message,
      name: err.name
    });
  }
}

// ─── Health check (no auth) ───────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'MACL FMS BigQuery API', status: 'OK', version: '1.0.0' });
});

// ─── External flights proxy (public endpoint) ─────────────────────────────────
app.get('/external-flights', async (_req: Request, res: Response) => {
  try {
    console.log('[Proxy] Fetching external flights from www.fis.com.mv...');
    const response = await fetch('https://www.fis.com.mv/api/flights');
    if (!response.ok) {
      throw new Error(`Failed to fetch from www.fis.com.mv: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('[Proxy] Error fetching external flights:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// filling_station_log Endpoints
// ═══════════════════════════════════════════════════════════════════════════
app.get('/filling-station-log', requireAuth, async (req: Request, res: Response) => {
  const { startDate, endDate, searchTerm, page, limit } = req.query;

  let filterClauses = [];
  const queryParams: Record<string, any> = {};

  if (startDate) {
    filterClauses.push("date >= @startDate");
    queryParams.startDate = startDate;
  }
  if (endDate) {
    filterClauses.push("date <= @endDate");
    queryParams.endDate = endDate;
  }
  if (searchTerm) {
    filterClauses.push("(LOWER(vehicle_reg) LIKE @searchTerm OR LOWER(driver_name) LIKE @searchTerm OR LOWER(invoice_number) LIKE @searchTerm OR LOWER(station) LIKE @searchTerm OR LOWER(fuel_type) LIKE @searchTerm)");
    queryParams.searchTerm = `%${String(searchTerm).toLowerCase()}%`;
  }

  const whereClause = filterClauses.length > 0
    ? `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE) AND ${filterClauses.join(' AND ')}`
    : `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE)`;

  const limitCount = parseInt(limit as string) || 50;
  const pageNum = parseInt(page as string) || 1;
  const offset = (pageNum - 1) * limitCount;

  const countSql = `
    SELECT COUNT(1) AS total, SUM(volume) AS total_volume
    FROM (
      SELECT id, is_deleted, created_at, updated_at, date, vehicle_reg, driver_name, invoice_number, station, fuel_type, volume,
             ROW_NUMBER() OVER (
               PARTITION BY id
               ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
             ) AS rn
      FROM ${FILLING_STATION_TABLE_REF}
    )
    ${whereClause}
  `;

  const dataSql = `
    SELECT * EXCEPT(rn)
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
      ) AS rn
      FROM ${FILLING_STATION_TABLE_REF}
    )
    ${whereClause}
    ORDER BY date DESC, created_at DESC
    LIMIT ${limitCount} OFFSET ${offset}
  `;

  try {
    const [[countResult], [rows]] = await Promise.all([
      bigquery.query({ query: countSql, params: queryParams, location: 'US' }),
      bigquery.query({ query: dataSql, params: queryParams, location: 'US' })
    ]);
    const totalCount = countResult ? parseInt(countResult[0]?.total || '0') : 0;
    const totalVolume = countResult ? parseFloat(countResult[0]?.total_volume || '0') : 0;
    res.json({ logs: rows.map(cleanBigQueryRow), totalCount, totalVolume });
  } catch (err: any) {
    console.error('[BigQuery] GET filling-station-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/filling-station-log', requireAuth, async (req: Request, res: Response) => {
  const newId = `fs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const row = {
    id: newId,
    station: req.body.station,
    fuel_type: req.body.fuelType,
    date: req.body.date,
    invoice_number: req.body.invoiceNumber || null,
    vehicle_reg: req.body.vehicleReg,
    driver_name: req.body.driverName || null,
    volume: parseFloat(req.body.volume) || 0,
    payment_mode: req.body.paymentMode || null,
    received_by: req.body.receivedBy || null,
    equipment_name: req.body.equipmentName || null,
    operator_id: req.body.operatorId || null,
    remarks: req.body.remarks || null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  const activeEntries = Object.entries(row).filter(([_, val]) => val !== null && val !== undefined);
  const columns = activeEntries.map(([k]) => k);
  const paramRefs = columns.map(c => `@${c}`).join(', ');
  const columnList = columns.join(', ');
  const params = Object.fromEntries(activeEntries);
  const sql = `INSERT INTO ${FILLING_STATION_TABLE_REF} (${columnList}) VALUES (${paramRefs})`;
  try {
    await bigquery.query({ query: sql, params, location: 'US' });
    res.status(201).json({ id: newId, message: 'Filling station log entry created.' });
  } catch (err: any) {
    console.error('[BigQuery] POST filling-station-log error:', err.message, err.errors);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/filling-station-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as Record<string, any>;
  const fieldMap: Record<string, string> = {
    station: 'station',
    fuelType: 'fuel_type',
    date: 'date',
    invoiceNumber: 'invoice_number',
    vehicleReg: 'vehicle_reg',
    driverName: 'driver_name',
    volume: 'volume',
    paymentMode: 'payment_mode',
    receivedBy: 'received_by',
    equipmentName: 'equipment_name',
    operatorId: 'operator_id',
    remarks: 'remarks',
  };
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP()'];
  const params: Record<string, any> = { record_id: id };
  for (const [js, bq] of Object.entries(fieldMap)) {
    if (js in updates) {
      setClauses.push(`${bq} = @${js}`);
      params[js] = updates[js] ?? null;
    }
  }
  if (setClauses.length === 1) {
    res.status(400).json({ error: 'No valid fields to update.' });
    return;
  }
  const sql = `UPDATE ${FILLING_STATION_TABLE_REF} SET ${setClauses.join(', ')} WHERE id = @record_id`;
  try {
    await bigquery.query({ query: sql, params, location: 'US' });
    res.json({ message: 'Filling station log updated.' });
  } catch (err: any) {
    console.error('[BigQuery] PATCH filling-station-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/filling-station-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const sql = `UPDATE ${FILLING_STATION_TABLE_REF} SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP() WHERE id = @record_id`;
  try {
    await bigquery.query({ query: sql, params: { record_id: id }, location: 'US' });
    res.json({ message: 'Filling station log deleted.' });
  } catch (err: any) {
    console.error('[BigQuery] DELETE filling-station-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// refueler_loading_log Endpoints
// ═══════════════════════════════════════════════════════════════════════════
app.get('/refueler-loading-log', requireAuth, async (req: Request, res: Response) => {
  const { startDate, endDate, searchTerm, page, limit } = req.query;

  let filterClauses = [];
  const queryParams: Record<string, any> = {};

  if (startDate) {
    filterClauses.push("date >= @startDate");
    queryParams.startDate = startDate;
  }
  if (endDate) {
    filterClauses.push("date <= @endDate");
    queryParams.endDate = endDate;
  }
  if (searchTerm) {
    filterClauses.push("(LOWER(vehicle_id) LIKE @searchTerm OR LOWER(source_tank_id) LIKE @searchTerm OR LOWER(operator_id) LIKE @searchTerm)");
    queryParams.searchTerm = `%${String(searchTerm).toLowerCase()}%`;
  }

  const whereClause = filterClauses.length > 0
    ? `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE) AND ${filterClauses.join(' AND ')}`
    : `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE)`;

  const limitCount = parseInt(limit as string) || 50;
  const pageNum = parseInt(page as string) || 1;
  const offset = (pageNum - 1) * limitCount;

  const countSql = `
    SELECT COUNT(1) AS total, SUM(volume) AS total_volume
    FROM (
      SELECT id, is_deleted, created_at, updated_at, date, vehicle_id, source_tank_id, operator_id, volume,
             ROW_NUMBER() OVER (
               PARTITION BY id
               ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
             ) AS rn
      FROM ${REFUELER_LOADING_TABLE_REF}
    )
    ${whereClause}
  `;

  const dataSql = `
    SELECT * EXCEPT(rn)
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
      ) AS rn
      FROM ${REFUELER_LOADING_TABLE_REF}
    )
    ${whereClause}
    ORDER BY date DESC, created_at DESC
    LIMIT ${limitCount} OFFSET ${offset}
  `;
  try {
    const [[countResult], [rows]] = await Promise.all([
      bigquery.query({ query: countSql, params: queryParams, location: 'US' }),
      bigquery.query({ query: dataSql, params: queryParams, location: 'US' })
    ]);
    const totalCount = countResult ? parseInt(countResult[0]?.total || '0') : 0;
    const totalVolume = countResult ? parseFloat(countResult[0]?.total_volume || '0') : 0;
    res.json({ logs: rows.map(cleanBigQueryRow), totalCount, totalVolume });
  } catch (err: any) {
    console.error('[BigQuery] GET refueler-loading-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/refueler-loading-log', requireAuth, async (req: Request, res: Response) => {
  const newId = `rl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const row = {
    id: newId,
    source_tank_id: req.body.sourceTankId,
    vehicle_id: req.body.vehicleId,
    volume: parseFloat(req.body.volume) || 0,
    start_time: req.body.startTime || null,
    end_time: req.body.endTime || null,
    date: req.body.date,
    visual_check_passed: !!req.body.visualCheckPassed,
    cwd_check_passed: !!req.body.cwdCheckPassed,
    density: req.body.density ? parseFloat(req.body.density) : null,
    temperature: req.body.temperature ? parseFloat(req.body.temperature) : null,
    operator_name: req.body.operatorName || null,
    supervisor_name: req.body.supervisorName || null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  const activeEntries = Object.entries(row).filter(([_, val]) => val !== null && val !== undefined);
  const columns = activeEntries.map(([k]) => k);
  const paramRefs = columns.map(c => `@${c}`).join(', ');
  const columnList = columns.join(', ');
  const params = Object.fromEntries(activeEntries);
  const sql = `INSERT INTO ${REFUELER_LOADING_TABLE_REF} (${columnList}) VALUES (${paramRefs})`;
  try {
    await bigquery.query({ query: sql, params, location: 'US' });
    res.status(201).json({ id: newId, message: 'Refueler loading log entry created.' });
  } catch (err: any) {
    console.error('[BigQuery] POST refueler-loading-log error:', err.message, err.errors);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/refueler-loading-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as Record<string, any>;
  const fieldMap: Record<string, string> = {
    sourceTankId: 'source_tank_id',
    vehicleId: 'vehicle_id',
    volume: 'volume',
    startTime: 'start_time',
    endTime: 'end_time',
    date: 'date',
    visualCheckPassed: 'visual_check_passed',
    cwdCheckPassed: 'cwd_check_passed',
    density: 'density',
    temperature: 'temperature',
    operatorName: 'operator_name',
    supervisorName: 'supervisor_name',
  };
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP()'];
  const params: Record<string, any> = { record_id: id };
  for (const [js, bq] of Object.entries(fieldMap)) {
    if (js in updates) {
      setClauses.push(`${bq} = @${js}`);
      params[js] = updates[js] ?? null;
    }
  }
  if (setClauses.length === 1) {
    res.status(400).json({ error: 'No valid fields to update.' });
    return;
  }
  const sql = `UPDATE ${REFUELER_LOADING_TABLE_REF} SET ${setClauses.join(', ')} WHERE id = @record_id`;
  try {
    await bigquery.query({ query: sql, params, location: 'US' });
    res.json({ message: 'Refueler loading log updated.' });
  } catch (err: any) {
    console.error('[BigQuery] PATCH refueler-loading-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/refueler-loading-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const sql = `UPDATE ${REFUELER_LOADING_TABLE_REF} SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP() WHERE id = @record_id`;
  try {
    await bigquery.query({ query: sql, params: { record_id: id }, location: 'US' });
    res.json({ message: 'Refueler loading log deleted.' });
  } catch (err: any) {
    console.error('[BigQuery] DELETE refueler-loading-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /operations-log   — list all (non-deleted) entries
// ═══════════════════════════════════════════════════════════════════════════
app.get('/operations-log', requireAuth, async (req: Request, res: Response) => {
  const { startDate, endDate, searchTerm, logType, flightCategory, equipmentId, page, limit, sortField, sortOrder } = req.query;

  let filterClauses = [];
  const queryParams: Record<string, any> = {};

  if (startDate) {
    filterClauses.push("COALESCE(operational_date, date(created_at)) >= @startDate");
    queryParams.startDate = startDate;
  }
  if (endDate) {
    filterClauses.push("COALESCE(operational_date, date(created_at)) <= @endDate");
    queryParams.endDate = endDate;
  }
  if (searchTerm) {
    filterClauses.push("(LOWER(flight_number) LIKE @searchTerm OR LOWER(aircraft_reg) LIKE @searchTerm OR LOWER(airline) LIKE @searchTerm OR LOWER(vehicle_id) LIKE @searchTerm OR LOWER(delivery_number) LIKE @searchTerm OR LOWER(remarks) LIKE @searchTerm)");
    queryParams.searchTerm = `%${String(searchTerm).toLowerCase()}%`;
  }

  // Handle logType filter in database
  if (logType === 'FLIGHT') {
    filterClauses.push("( (log_type = 'FLIGHT' OR log_type IS NULL) AND NOT STARTS_WITH(flight_number, 'SEAPLANE') AND NOT STARTS_WITH(flight_number, 'GROUND-') AND NOT STARTS_WITH(flight_number, 'VESSEL-') AND NOT STARTS_WITH(flight_number, 'LOAD-') AND NOT UPPER(COALESCE(airline, co, '')) LIKE '%SEAPLANE%' AND NOT UPPER(COALESCE(airline, co, '')) LIKE '%LOCAL SALES%' AND NOT UPPER(COALESCE(airline, co, '')) LIKE '%OTHERS%' AND NOT UPPER(COALESCE(route, '')) = 'SEA' )");
  } else if (logType === 'SEAPLANE') {
    filterClauses.push("( log_type = 'SEAPLANE' OR STARTS_WITH(flight_number, 'SEAPLANE-') OR UPPER(COALESCE(airline, co, '')) LIKE '%SEAPLANE%' OR UPPER(route) = 'SEA' )");
  } else if (logType === 'MARINE') {
    filterClauses.push("( log_type = 'MARINE' OR STARTS_WITH(flight_number, 'VESSEL-') OR UPPER(COALESCE(airline, co, '')) LIKE '%LOCAL SALES%' OR UPPER(COALESCE(airline, co, '')) LIKE '%OTHERS%' )");
  } else if (logType === 'TOTALIZER_READINGS') {
    filterClauses.push(`(
      NOT STARTS_WITH(flight_number, 'SEAPLANE') 
      AND vehicle_id IS NOT NULL 
      AND vehicle_id != 'N/A' 
      AND UPPER(vehicle_id) != 'N/A'
      AND NOT UPPER(vehicle_id) LIKE '%SCADA%' 
      AND (STARTS_WITH(UPPER(vehicle_id), 'RF') OR STARTS_WITH(UPPER(vehicle_id), 'HD'))
      AND (meter_open IS NOT NULL OR meter_close IS NOT NULL OR (volume > 0))
    )`);
    if (equipmentId && equipmentId !== 'ALL') {
      filterClauses.push("vehicle_id = @equipmentId");
      queryParams.equipmentId = equipmentId;
    }
  }

  // Handle flightCategory filter for flights
  if (logType === 'FLIGHT' && flightCategory && flightCategory !== 'ALL') {
    if (flightCategory === 'DOM') {
      filterClauses.push("is_domestic = TRUE");
    } else if (flightCategory === 'INT') {
      filterClauses.push("is_domestic = FALSE");
    }
  }

  const whereClause = filterClauses.length > 0
    ? `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE) AND ${filterClauses.join(' AND ')}`
    : `WHERE rn = 1 AND (is_deleted IS NULL OR is_deleted = FALSE)`;

  // Pagination parameters
  const limitCount = parseInt(limit as string) || 50;
  const pageNum = parseInt(page as string) || 1;
  const offset = (pageNum - 1) * limitCount;

  // Sorting
  let orderBy = "COALESCE(operational_date, date(created_at)) DESC, created_at DESC";
  if (sortField === 'ticket') {
    orderBy = `delivery_number ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, COALESCE(operational_date, date(created_at)) DESC`;
  } else if (sortField === 'meterOpen') {
    orderBy = `COALESCE(meter_open, 0) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (sortField === 'meterClose') {
    orderBy = `COALESCE(meter_close, COALESCE(meter_open, 0) + COALESCE(volume, 0)) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (sortField === 'date') {
    orderBy = `COALESCE(operational_date, date(created_at)) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  }

  // Count Query
  const countSql = `
    SELECT COUNT(1) AS total, SUM(volume) AS total_volume
    FROM (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY id
               ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
             ) AS rn
      FROM ${TABLE_REF}
    )
    ${whereClause}
  `;

  // Data Query
  const dataSql = `
    SELECT * EXCEPT(rn)
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY COALESCE(updated_at, created_at, TIMESTAMP('1970-01-01')) DESC
      ) AS rn
      FROM ${TABLE_REF}
    )
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limitCount} OFFSET ${offset}
  `;

  console.log(`[BigQuery SQL]\n${dataSql.trim()}`);
  try {
    const [[countResult], [rows]] = await Promise.all([
      bigquery.query({ query: countSql, params: queryParams, location: 'US' }),
      bigquery.query({ query: dataSql, params: queryParams, location: 'US' })
    ]);
    const totalCount = countResult ? parseInt(countResult[0]?.total || '0') : 0;
    const totalVolume = countResult ? parseFloat(countResult[0]?.total_volume || '0') : 0;
    res.json({ logs: rows.map(rowToLog), totalCount, totalVolume });
  } catch (err: any) {
    console.error('[BigQuery] GET operations-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /operations-log  — insert new log entry
// ═══════════════════════════════════════════════════════════════════════════
app.post('/operations-log', requireAuth, async (req: Request, res: Response) => {
  const newId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = logToRow(req.body, newId);
  console.log(`[BigQuery SQL] INSERT → id=${newId}, delivery_number=${row.delivery_number}`);

  // Build column list and parameter map from the row object, filtering out null/undefined values
  const activeEntries = Object.entries(row).filter(([_, val]) => val !== null && val !== undefined);
  const columns = activeEntries.map(([k]) => k);
  const paramRefs = columns.map(c => `@${c}`).join(', ');
  const columnList = columns.join(', ');

  // Build typed params for BigQuery parameterized query (only non-null fields)
  const params = Object.fromEntries(activeEntries);

  const sql = `INSERT INTO ${TABLE_REF} (${columnList}) VALUES (${paramRefs})`;

  try {
    await bigquery.query({ query: sql, params, location: 'US' });
    res.status(201).json({ id: newId, message: 'Log entry created.' });
  } catch (err: any) {
    console.error('[BigQuery] POST error:', err.message, err.errors);
    res.status(500).json({ error: err.message, details: err.errors });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /operations-log/:id  — update fields of an existing entry
// ═══════════════════════════════════════════════════════════════════════════
const PARAM_TYPES: Record<string, string> = {
  record_id: 'STRING',
  flightNumber: 'STRING',
  aircraftReg: 'STRING',
  aircraftType: 'STRING',
  stand: 'STRING',
  operatorId: 'STRING',
  vehicleId: 'STRING',
  status: 'STRING',
  deliveryNumber: 'STRING',
  meterOpen: 'FLOAT64',
  meterClose: 'FLOAT64',
  volume: 'FLOAT64',
  panelCheck: 'BOOL',
  walkAroundCheck: 'BOOL',
  appearanceCheck: 'BOOL',
  waterCheck: 'BOOL',
  timestampArrived: 'TIMESTAMP',
  timestampPosition: 'TIMESTAMP',
  timestampStart: 'TIMESTAMP',
  timestampInitialEnd: 'TIMESTAMP',
  timestampFinalStart: 'TIMESTAMP',
  timestampFinalEnd: 'TIMESTAMP',
  timestampClearance: 'TIMESTAMP',
  remarks: 'STRING',
  tacticalOperator: 'STRING',
  logType: 'STRING',
  route: 'STRING',
  co: 'STRING',
  isDomestic: 'BOOL',
  airline: 'STRING',
  operationalDate: 'STRING',
  pitNumber: 'STRING',
  isAdhoc: 'BOOL',
  psi: 'FLOAT64',
  lpm: 'FLOAT64',
  officer: 'STRING',
  operatorName: 'STRING',
  destination: 'STRING',
  paymentType: 'STRING',
};

app.patch('/operations-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as Record<string, any>;

  // Map camelCase → snake_case columns
  const fieldMap: Record<string, string> = {
    flightNumber:        'flight_number',
    aircraftReg:         'aircraft_reg',
    aircraftType:        'aircraft_type',
    stand:               'stand',
    operatorId:          'operator_id',
    vehicleId:           'vehicle_id',
    status:              'status',
    deliveryNumber:      'delivery_number',
    meterOpen:           'meter_open',
    meterClose:          'meter_close',
    volume:              'volume',
    panelCheck:          'panel_check',
    walkAroundCheck:     'walk_around_check',
    appearanceCheck:     'appearance_check',
    waterCheck:          'water_check',
    timestampArrived:    'timestamp_arrived',
    timestampPosition:   'timestamp_position',
    timestampStart:      'timestamp_start',
    timestampInitialEnd: 'timestamp_initial_end',
    timestampFinalStart: 'timestamp_final_start',
    timestampFinalEnd:   'timestamp_final_end',
    timestampClearance:  'timestamp_clearance',
    remarks:             'remarks',
    tacticalOperator:    'tactical_operator',
    logType:             'log_type',
    route:               'route',
    co:                  'co',
    isDomestic:          'is_domestic',
    airline:             'airline',
    operationalDate:     'operational_date',
    pitNumber:           'pit_number',
    isAdhoc:             'is_adhoc',
    psi:                 'psi',
    lpm:                 'lpm',
    officer:             'officer',
    operatorName:        'operator_name',
    destination:         'destination',
    paymentType:         'payment_type',
  };

  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP()'];
  const params: Record<string, any> = { record_id: id };

  for (const [js, bq] of Object.entries(fieldMap)) {
    if (js in updates) {
      setClauses.push(`${bq} = @${js}`);
      params[js] = updates[js] ?? null;
    }
  }

  if (setClauses.length === 1) {
    res.status(400).json({ error: 'No valid fields to update.' });
    return;
  }

  const sql = `
    UPDATE ${TABLE_REF}
    SET ${setClauses.join(', ')}
    WHERE id = @record_id
  `;
  console.log(`[BigQuery SQL] UPDATE id=${id} SET ${setClauses.join(', ')}`);

  // Build the parameter types mapping to handle null values in BigQuery query execution
  const types: Record<string, string> = {};
  for (const key of Object.keys(params)) {
    if (PARAM_TYPES[key]) {
      types[key] = PARAM_TYPES[key];
    }
  }

  try {
    await bigquery.query({ query: sql, params, location: 'US', types });
    res.json({ message: 'Log entry updated.' });
  } catch (err: any) {
    console.error('[BigQuery] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /operations-log/:id  — soft-delete (is_deleted = TRUE)
// ═══════════════════════════════════════════════════════════════════════════
app.delete('/operations-log/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateSql = `
    UPDATE ${TABLE_REF}
    SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP()
    WHERE id = @record_id
  `;
  console.log(`[BigQuery SQL] SOFT DELETE id=${id}`);
  try {
    await bigquery.query({ query: updateSql, params: { record_id: id }, location: 'US' });
    res.json({ message: 'Log entry deleted.' });
  } catch (err: any) {
    // If the row is in the streaming buffer, fall back to inserting a tombstone row.
    // The GET query deduplicates by id (latest updated_at wins), so this tombstone
    // will mask the original buffered row.
    if (err.message && err.message.includes('streaming buffer')) {
      console.warn(`[BigQuery] Row ${id} is in streaming buffer — inserting tombstone row`);
      const tombstoneSql = `
        INSERT INTO ${TABLE_REF} (id, log_type, is_deleted, created_at, updated_at)
        VALUES (@record_id, 'TOMBSTONE', TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `;
      try {
        await bigquery.query({ query: tombstoneSql, params: { record_id: id }, location: 'US' });
        res.json({ message: 'Log entry deleted.' });
      } catch (tombstoneErr: any) {
        console.error('[BigQuery] Tombstone INSERT error:', tombstoneErr.message);
        res.status(500).json({ error: tombstoneErr.message });
      }
    } else {
      console.error('[BigQuery] DELETE error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /migrate-legacy-data — import batch of legacy flight records
// ═══════════════════════════════════════════════════════════════════════════
app.post('/migrate-legacy-data', requireAuth, async (req: Request, res: Response) => {
  const records = req.body?.records;
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: 'Payload must contain a non-empty "records" array.' });
    return;
  }

  console.log(`[Migration] Starting import for ${records.length} legacy records...`);

  const parseTime = (dateStr?: string | null, timeStr?: string | null): string | null => {
    if (!dateStr || !timeStr || !timeStr.trim() || timeStr.trim() === '-') return null;
    const cleanTime = timeStr.trim();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `${dateStr}T${hh}:${mm}:${ss}.000Z`;
  };

  const rowsToInsert = records.map((rec: any) => {
    const deliveryNo = rec.DELIVERY_NO !== undefined && rec.DELIVERY_NO !== null ? String(rec.DELIVERY_NO) : '';
    const id = deliveryNo ? `hist-${deliveryNo}` : `hist-gen-${Math.random().toString(36).slice(2, 10)}`;
    const dateStr = rec.DATE ? String(rec.DATE).split('T')[0] : null;
    const intDomRaw = String(rec.INT_DOM || '').toUpperCase();
    const isDomestic = intDomRaw.includes('DOM');

    return {
      id,
      log_type:              'FLIGHT',
      flight_number:         rec.FLIGHT || null,
      aircraft_reg:          rec.AIRCRAFT_REG || null,
      aircraft_type:         rec.AIRCRAFT_TYPE || null,
      stand:                 rec.STAND || null,
      operator_id:           null,
      vehicle_id:            rec.RF_NO || null,
      status:                'COMPLETED',
      delivery_number:       deliveryNo || null,
      meter_open:            null,
      meter_close:           null,
      volume:                rec.VOLUME !== null && rec.VOLUME !== undefined ? parseFloat(rec.VOLUME) : null,
      panel_check:           true,
      walk_around_check:     true,
      appearance_check:      true,
      water_check:           true,
      timestamp_arrived:     parseTime(dateStr, rec.ARRIVED),
      timestamp_position:    parseTime(dateStr, rec.ARRIVED),
      timestamp_start:       parseTime(dateStr, rec.STARTED),
      timestamp_initial_end: null,
      timestamp_final_start: null,
      timestamp_final_end:   parseTime(dateStr, rec.ENDED),
      timestamp_clearance:   parseTime(dateStr, rec.ENDED),
      remarks:               rec.CUSTOMER_NAME ? `Customer: ${rec.CUSTOMER_NAME}` : null,
      tactical_operator:     rec.RF_OPERATOR || null,
      route:                 null,
      co:                    rec.CUSTOMER_NAME || null,
      is_domestic:           isDomestic,
      airline:               rec.CUSTOMER_NAME || null,
      operational_date:      dateStr,
      pit_number:            rec.PIT_NO || null,
      is_adhoc:              false,
      psi:                   rec.Psi !== null && rec.Psi !== undefined ? parseFloat(rec.Psi) : null,
      lpm:                   rec.LPM !== null && rec.LPM !== undefined ? parseFloat(rec.LPM) : null,
      officer:               rec.OFFICER || null,
      operator_name:         rec.OPERATOR_NAME || null,
      destination:           null,
      payment_type:          rec.OR_CREDIT || null,
      is_deleted:            false,
      created_at:            dateStr ? `${dateStr}T00:00:00.000Z` : new Date().toISOString(),
      updated_at:            new Date().toISOString(),
    };
  });

  // Batch insert into BigQuery (chunks of 500)
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
      const dataset = bigquery.dataset(DATASET_ID);
      const table = dataset.table(TABLE_ID);
      
      try {
        await table.insert(chunk, { skipInvalidRows: true, ignoreUnknownValues: true });
        insertedCount += chunk.length;
        console.log(`[Migration] Inserted chunk ${i / BATCH_SIZE + 1} (${insertedCount}/${rowsToInsert.length})`);
      } catch (err: any) {
        console.error(`[Migration] Chunk ${i / BATCH_SIZE + 1} insert error:`, err.message, err.errors);
        errorCount += chunk.length;
      }
    }
    res.json({ message: `Migration complete. Inserted: ${insertedCount}, Errors: ${errorCount}` });
  } catch (err: any) {
    console.error('[Migration] Fatal error:', err.message);
    res.status(500).json({ error: err.message, insertedCount, errorCount });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8080', 10);

// Start listening FIRST so Cloud Run health checks pass immediately,
// then run the slow BigQuery schema migration in the background.
app.listen(PORT, () => {
  console.log(`[Server] MACL FMS BigQuery API listening on port ${PORT}`);

  // Run schema check in background — non-blocking, non-fatal
  ensureSchema()
    .then(() => console.log(`[Bootstrap] Schema OK — ${DATASET_ID}.${TABLE_ID} ready.`))
    .catch((err) => console.error('[Bootstrap] Schema check failed (non-fatal):', err));
});
