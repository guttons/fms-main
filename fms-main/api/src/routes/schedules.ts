import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToSchedule(row: any) {
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airlineCode: row.airline_code || undefined,
    airlineName: row.airline_name,
    origin: row.origin || 'MLE',
    destination: row.destination || 'MLE',
    sta: row.sta || '00:00',
    std: row.std || '00:00',
    daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week : [1, 2, 3, 4, 5, 6, 7],
    aircraftType: row.aircraft_type || 'A320',
    estimatedUpliftLiters: Number(row.estimated_uplift_liters) || 0,
    effectiveFrom: row.effective_from || '2026-03-29',
    effectiveTo: row.effective_to || '2026-10-24',
    isActive: row.is_active ?? true,
    isDomestic: !!row.is_domestic,
    season: row.season || undefined,
    uploadedAt: row.uploaded_at || row.created_at || new Date().toISOString(),
    uploadedBy: row.uploaded_by || undefined,
    sourceFilename: row.source_filename || undefined
  };
}

// GET /schedules
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { flightNumber, airlineName, isActive } = req.query;
    let query = supabase.from('international_schedules').select('*');

    if (flightNumber) {
      query = query.ilike('flight_number', `%${String(flightNumber)}%`);
    }
    if (airlineName) {
      query = query.ilike('airline_name', `%${String(airlineName)}%`);
    }
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;
    if (error) {
      // Fallback if table doesn't exist yet on cloud Supabase
      console.warn('[API] GET /schedules error:', error.message);
      return res.json({ schedules: [] });
    }

    const schedules = (data || []).map(mapRowToSchedule);
    return res.json({ schedules });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /schedules
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sch = req.body;
    const row = {
      id: sch.id || `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      flight_number: sch.flightNumber,
      airline_code: sch.airlineCode || null,
      airline_name: sch.airlineName,
      origin: sch.origin,
      destination: sch.destination,
      sta: sch.sta,
      std: sch.std,
      days_of_week: sch.daysOfWeek,
      aircraft_type: sch.aircraftType,
      estimated_uplift_liters: sch.estimatedUpliftLiters,
      effective_from: sch.effectiveFrom,
      effective_to: sch.effectiveTo,
      is_active: sch.isActive ?? true,
      is_domestic: sch.isDomestic ?? false,
      season: sch.season || null,
      uploaded_at: new Date().toISOString(),
      uploaded_by: sch.uploadedBy || null,
      source_filename: sch.sourceFilename || null
    };

    const { data, error } = await supabase.from('international_schedules').upsert([row]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ schedule: mapRowToSchedule(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /schedules/bulk
router.post('/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'schedules array is required' });
    }

    const rows = schedules.map(sch => ({
      id: sch.id || `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      flight_number: sch.flightNumber,
      airline_code: sch.airlineCode || null,
      airline_name: sch.airlineName,
      origin: sch.origin,
      destination: sch.destination,
      sta: sch.sta,
      std: sch.std,
      days_of_week: sch.daysOfWeek,
      aircraft_type: sch.aircraftType,
      estimated_uplift_liters: sch.estimatedUpliftLiters,
      effective_from: sch.effectiveFrom,
      effective_to: sch.effectiveTo,
      is_active: sch.isActive ?? true,
      is_domestic: sch.isDomestic ?? false,
      season: sch.season || null,
      uploaded_at: sch.uploadedAt || new Date().toISOString(),
      uploaded_by: sch.uploadedBy || null,
      source_filename: sch.sourceFilename || null
    }));

    const { error } = await supabase.from('international_schedules').upsert(rows);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /schedules/:id/toggle
router.patch('/:id/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const { error } = await supabase.from('international_schedules').update({ is_active: !!isActive }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id, isActive });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /schedules/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('international_schedules').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /schedules - Clear all
router.delete('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('international_schedules').delete().neq('id', '');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, message: 'All schedules cleared' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
