import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToDelayLog(row: any) {
  return {
    id: row.id,
    date: row.operational_date,
    delayFrom: row.delay_from,
    operator: row.operator,
    flightNumber: row.flight_number,
    delayCode: row.delay_code || '',
    delayReason: row.delay_reason || '',
    remarks: row.remarks || '',
    fuelTeam: row.fuel_team || '',
    fuelTeamComment: row.fuel_team_comment || '',
    dutyInCharge: row.duty_in_charge || '',
    status: row.status || 'PENDING',
    flightLogId: row.flight_log_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /delay-logs
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;
    let query = supabase
      .from('delay_logs')
      .select('*')
      .order('operational_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('operational_date', String(startDate));
    if (endDate) query = query.lte('operational_date', String(endDate));
    if (status) query = query.eq('status', String(status));

    const { data, error } = await query;
    if (error) {
      console.warn('[API] GET /delay-logs error:', error.message);
      return res.json({ logs: [] });
    }

    const logs = (data || []).map(mapRowToDelayLog);
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /delay-logs
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = req.body;
    const row = {
      operational_date: log.date,
      delay_from: log.delayFrom,
      operator: log.operator,
      flight_number: log.flightNumber,
      delay_code: log.delayCode || null,
      delay_reason: log.delayReason || null,
      remarks: log.remarks || null,
      fuel_team: log.fuelTeam || null,
      fuel_team_comment: log.fuelTeamComment || null,
      duty_in_charge: log.dutyInCharge || null,
      status: log.status || 'PENDING',
      flight_log_id: log.flightLogId || null
    };

    const { data, error } = await supabase.from('delay_logs').insert([row]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ log: data ? mapRowToDelayLog(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /delay-logs/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if ('date' in updates) row.operational_date = updates.date;
    if ('delayFrom' in updates) row.delay_from = updates.delayFrom;
    if ('operator' in updates) row.operator = updates.operator;
    if ('flightNumber' in updates) row.flight_number = updates.flightNumber;
    if ('delayCode' in updates) row.delay_code = updates.delayCode;
    if ('delayReason' in updates) row.delay_reason = updates.delayReason;
    if ('remarks' in updates) row.remarks = updates.remarks;
    if ('fuelTeam' in updates) row.fuel_team = updates.fuelTeam;
    if ('fuelTeamComment' in updates) row.fuel_team_comment = updates.fuelTeamComment;
    if ('dutyInCharge' in updates) row.duty_in_charge = updates.dutyInCharge;
    if ('status' in updates) row.status = updates.status;
    if ('flightLogId' in updates) row.flight_log_id = updates.flightLogId;

    const { data, error } = await supabase.from('delay_logs').update(row).eq('id', id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, log: data ? mapRowToDelayLog(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /delay-logs/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('delay_logs').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
