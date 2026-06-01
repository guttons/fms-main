import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { BigQuery, TableSchema } from '@google-cloud/bigquery';

// ─── BigQuery client ─────────────────────────────────────────────────────────
const bigquery = new BigQuery({ projectId: 'macl-fms-496808' });

const DATASET_ID  = 'fms_data';
const TABLE_ID    = 'operations_log';
const PROJECT_ID  = 'macl-fms-496808';
const TABLE_REF   = `\`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``;

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
    { name: 'timestamp_final_end',  type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'timestamp_clearance',  type: 'TIMESTAMP', mode: 'NULLABLE'  },
    { name: 'remarks',              type: 'STRING',    mode: 'NULLABLE'  },
    { name: 'tactical_operator',    type: 'STRING',    mode: 'NULLABLE'  },
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
  }
}

// ─── Row mappers ─────────────────────────────────────────────────────────────
function rowToLog(row: Record<string, any>) {
  const ts = (v: any) => v?.value ?? v ?? null;
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
    timestampFinalEnd:   ts(row.timestamp_final_end),
    timestampClearance:  ts(row.timestamp_clearance),
    remarks:             row.remarks,
    tacticalOperator:    row.tactical_operator,
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
    timestamp_final_end:   log.timestampFinalEnd  ?? null,
    timestamp_clearance:   log.timestampClearance ?? null,
    remarks:               log.remarks             ?? null,
    tactical_operator:     log.tacticalOperator    ?? null,
    is_deleted:            false,
    created_at:            now,
    updated_at:            now,
  };
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://macl-fms.web.app',
    'https://macl-fms.firebaseapp.com',
  ],
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth] SUPABASE_JWT_SECRET environment variable is not set!');
      res.status(500).json({ error: 'Internal Server Error: Auth configuration missing.' });
      return;
    }
    let decoded;
    try {
      // Try verifying with base64 decoded buffer (standard for Supabase dashboard secrets)
      const base64Secret = Buffer.from(jwtSecret, 'base64');
      decoded = jwt.verify(idToken, base64Secret);
    } catch (err) {
      try {
        // Fallback: Try verifying with raw string secret
        decoded = jwt.verify(idToken, jwtSecret);
      } catch (err2) {
        console.error('[Auth] Token verification failed with both base64 and raw secret:', err2);
        throw err2;
      }
    }
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err);
    res.status(401).json({ error: 'Unauthorized: invalid Supabase ID token.' });
  }
}

// ─── Health check (no auth) ───────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'MACL FMS BigQuery API', status: 'OK', version: '1.0.0' });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /operations-log   — list all (non-deleted) entries
// ═══════════════════════════════════════════════════════════════════════════
app.get('/operations-log', requireAuth, async (_req: Request, res: Response) => {
  const sql = `
    SELECT *
    FROM ${TABLE_REF}
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
    ORDER BY delivery_number DESC
  `;
  console.log(`[BigQuery SQL]\n${sql.trim()}`);
  try {
    const [rows] = await bigquery.query({ query: sql, location: 'US' });
    res.json({ logs: rows.map(rowToLog), count: rows.length });
  } catch (err: any) {
    console.error('[BigQuery] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /operations-log  — insert new log entry
// ═══════════════════════════════════════════════════════════════════════════
app.post('/operations-log', requireAuth, async (req: Request, res: Response) => {
  const newId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = logToRow(req.body, newId);
  const sql = `INSERT INTO ${TABLE_REF} (id, delivery_number, log_type) VALUES ('${newId}', '${row.delivery_number}', '${row.log_type}') [+ all fields]`;
  console.log(`[BigQuery SQL] INSERT → id=${newId}, delivery_number=${row.delivery_number}`);
  try {
    const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
    await table.insert([row]);
    res.status(201).json({ id: newId, message: 'Log entry created.' });
  } catch (err: any) {
    console.error('[BigQuery] POST error:', err.message, err.errors);
    res.status(500).json({ error: err.message, details: err.errors });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /operations-log/:id  — update fields of an existing entry
// ═══════════════════════════════════════════════════════════════════════════
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
    timestampFinalEnd:   'timestamp_final_end',
    timestampClearance:  'timestamp_clearance',
    remarks:             'remarks',
    tacticalOperator:    'tactical_operator',
    logType:             'log_type',
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
  try {
    await bigquery.query({ query: sql, params, location: 'US' });
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
  const sql = `
    UPDATE ${TABLE_REF}
    SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP()
    WHERE id = @record_id
  `;
  console.log(`[BigQuery SQL] SOFT DELETE id=${id}`);
  try {
    await bigquery.query({ query: sql, params: { record_id: id }, location: 'US' });
    res.json({ message: 'Log entry deleted.' });
  } catch (err: any) {
    console.error('[BigQuery] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8080', 10);

(async () => {
  try {
    console.log('[Bootstrap] Verifying BigQuery schema...');
    await ensureSchema();
    console.log(`[Bootstrap] Schema OK — ${DATASET_ID}.${TABLE_ID} ready.`);
  } catch (err) {
    console.error('[Bootstrap] Schema check failed (will continue):', err);
  }

  app.listen(PORT, () => {
    console.log(`[Server] MACL FMS BigQuery API listening on port ${PORT}`);
  });
})();
