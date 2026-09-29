import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Helper to map DB row to FlightJob
function mapDbRowToJob(row: any) {
  let dateVal: string | undefined = undefined;
  let routeVal: string | undefined = undefined;
  let isDomesticVal: boolean | undefined = undefined;
  let isAdhocVal: boolean | undefined = undefined;
  let typeVal: 'arrival' | 'departure' | undefined = undefined;
  let remarksVal = row.remarks || '';
  let metaTObt: string | undefined = undefined;
  let metaFrtAirline: string | undefined = undefined;
  let metaFrtAocc: string | undefined = undefined;
  let metaFrtFor: string | undefined = undefined;
  let metaClearance: string | undefined = undefined;

  if (row.remarks && row.remarks.startsWith('{"_fms_meta":')) {
    try {
      const meta = JSON.parse(row.remarks);
      dateVal = meta.date;
      routeVal = meta.route;
      isDomesticVal = meta.isDomestic;
      isAdhocVal = meta.isAdhoc;
      typeVal = meta.type;
      remarksVal = meta.remarks || '';
      metaTObt = meta.tobt;
      metaFrtAirline = meta.frtAirline;
      metaFrtAocc = meta.frtAocc;
      metaFrtFor = meta.frtFor;
      metaClearance = meta.timestampClearance;
    } catch (e) {}
  }

  return {
    id: row.id,
    flightNumber: row.flight_number,
    aircraftReg: row.aircraft_reg,
    aircraftType: row.aircraft_type,
    stand: row.stand,
    sta: row.sta,
    eta: row.eta,
    std: row.std,
    assignedTo: row.assigned_to,
    assignedOfficer: row.assigned_officer,
    equipmentUsage: row.equipment_usage,
    status: row.status,
    vehicleId: row.vehicle_id,
    remarks: remarksVal,
    deliveryNumber: row.delivery_number,
    pitNumber: row.pit_number,
    date: dateVal || (row.id ? row.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined),
    route: routeVal,
    isDomestic: isDomesticVal,
    isAdhoc: isAdhocVal,
    type: typeVal,
    landed_alert_sent: !!row.landed_alert_sent,
    eta_alert_15_sent: !!row.eta_alert_15_sent,
    eta_alert_5_sent: !!row.eta_alert_5_sent,
    tobt: row.tobt || metaTObt,
    frtAirline: row.frt_airline || metaFrtAirline,
    frtAocc: row.frt_aocc || metaFrtAocc,
    frtFor: row.frt_for || metaFrtFor,
    timestampClearance: row.timestamp_clearance || metaClearance
  };
}

// GET /flight-jobs
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, flightNumber } = req.query;
    let query = supabase.from('flight_jobs').select('*');

    if (status) {
      query = query.eq('status', String(status));
    }
    if (flightNumber) {
      query = query.ilike('flight_number', `%${String(flightNumber)}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API] GET /flight-jobs error:', error);
      return res.status(500).json({ error: error.message });
    }

    const jobs = (data || []).map(mapDbRowToJob);
    return res.json({ jobs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /flight-jobs - Create or upsert flight job
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const job = req.body;
    if (!job.flightNumber) {
      return res.status(400).json({ error: 'flightNumber is required' });
    }

    const jobId = job.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const metaString = JSON.stringify({
      _fms_meta: true,
      date: job.date,
      route: job.route,
      isDomestic: job.isDomestic,
      isAdhoc: job.isAdhoc,
      type: job.type,
      tobt: job.tobt,
      frtAirline: job.frtAirline,
      frtAocc: job.frtAocc,
      frtFor: job.frtFor,
      timestampClearance: job.timestampClearance,
      remarks: job.remarks || ''
    });

    const row = {
      id: jobId,
      flight_number: job.flightNumber,
      aircraft_reg: job.aircraftReg,
      aircraft_type: job.aircraftType,
      stand: job.stand,
      sta: job.sta || null,
      eta: job.eta || null,
      std: job.std || null,
      assigned_to: job.assignedTo || null,
      assigned_officer: job.assignedOfficer || null,
      equipment_usage: job.equipmentUsage || null,
      status: job.status || 'PENDING',
      vehicle_id: job.vehicleId || null,
      remarks: metaString,
      delivery_number: job.deliveryNumber || null,
      pit_number: job.pitNumber || null,
      landed_alert_sent: !!job.landed_alert_sent,
      eta_alert_15_sent: !!job.eta_alert_15_sent,
      eta_alert_5_sent: !!job.eta_alert_5_sent,
      tobt: job.tobt || null,
      frt_airline: job.frtAirline || null,
      frt_aocc: job.frtAocc || null,
      frt_for: job.frtFor || null,
      timestamp_clearance: job.timestampClearance || null
    };

    const { data, error } = await supabase.from('flight_jobs').upsert([row]).select().maybeSingle();
    if (error) {
      console.error('[API] POST /flight-jobs error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ job: mapDbRowToJob(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /flight-jobs/:id - Update flight job
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const row: Record<string, any> = {};
    if ('flightNumber' in updates) row.flight_number = updates.flightNumber;
    if ('aircraftReg' in updates) row.aircraft_reg = updates.aircraftReg;
    if ('aircraftType' in updates) row.aircraft_type = updates.aircraftType;
    if ('stand' in updates) row.stand = updates.stand;
    if ('sta' in updates) row.sta = updates.sta === undefined ? null : updates.sta;
    if ('eta' in updates) row.eta = updates.eta === undefined ? null : updates.eta;
    if ('std' in updates) row.std = updates.std === undefined ? null : updates.std;
    if ('assignedTo' in updates) row.assigned_to = updates.assignedTo ? updates.assignedTo : null;
    if ('assignedOfficer' in updates) row.assigned_officer = updates.assignedOfficer ? updates.assignedOfficer : null;
    if ('equipmentUsage' in updates) row.equipment_usage = updates.equipmentUsage;
    if ('status' in updates) row.status = updates.status;
    if ('vehicleId' in updates) row.vehicle_id = !updates.vehicleId ? null : updates.vehicleId;
    if ('deliveryNumber' in updates) row.delivery_number = updates.deliveryNumber === undefined ? null : updates.deliveryNumber;
    if ('pitNumber' in updates) row.pit_number = updates.pitNumber === undefined ? null : updates.pitNumber;
    if ('landed_alert_sent' in updates) row.landed_alert_sent = updates.landed_alert_sent;
    if ('eta_alert_15_sent' in updates) row.eta_alert_15_sent = updates.eta_alert_15_sent;
    if ('eta_alert_5_sent' in updates) row.eta_alert_5_sent = updates.eta_alert_5_sent;
    if ('tobt' in updates) row.tobt = updates.tobt === undefined ? null : updates.tobt;
    if ('frtAirline' in updates) row.frt_airline = updates.frtAirline === undefined ? null : updates.frtAirline;
    if ('frtAocc' in updates) row.frt_aocc = updates.frtAocc === undefined ? null : updates.frtAocc;
    if ('frtFor' in updates) row.frt_for = updates.frtFor === undefined ? null : updates.frtFor;
    if ('timestampClearance' in updates) row.timestamp_clearance = updates.timestampClearance === undefined ? null : updates.timestampClearance;

    if ('remarks' in updates || 'date' in updates || 'route' in updates || 'isDomestic' in updates || 'isAdhoc' in updates || 'type' in updates || 'tobt' in updates || 'frtAirline' in updates || 'frtAocc' in updates || 'frtFor' in updates || 'timestampClearance' in updates) {
      const metaString = JSON.stringify({
        _fms_meta: true,
        date: updates.date,
        route: updates.route,
        isDomestic: updates.isDomestic,
        isAdhoc: updates.isAdhoc,
        type: updates.type,
        tobt: updates.tobt,
        frtAirline: updates.frtAirline,
        frtAocc: updates.frtAocc,
        frtFor: updates.frtFor,
        timestampClearance: updates.timestampClearance,
        remarks: updates.remarks || ''
      });
      row.remarks = metaString;
    }

    const { data, error } = await supabase.from('flight_jobs').update(row).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[API] PATCH /flight-jobs/:id error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, job: data ? mapDbRowToJob(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /flight-jobs/:id - Delete single flight job
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('flight_jobs').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /flight-jobs/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /flight-jobs - Clear all flight jobs
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('flight_jobs').delete().neq('id', '');
    if (error) {
      console.error('[API] DELETE /flight-jobs error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: 'All flight jobs cleared' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
