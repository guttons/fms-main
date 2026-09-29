import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /tanks - Get all tanks
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('tanks').select('*').order('name');
    if (error) {
      console.error('[API] GET /tanks error:', error);
      return res.status(500).json({ error: error.message });
    }
    const tanks = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      capacity: Number(row.capacity),
      currentLevel: Number(row.current_level),
      safeMinLevel: Number(row.safe_min_level),
      lastUpdated: row.last_updated
    }));
    return res.json({ tanks });
  } catch (err: any) {
    console.error('[API] GET /tanks exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /tanks/:id - Get specific tank
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('tanks').select('*').eq('id', id).maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Tank not found' });
    }
    return res.json({
      tank: {
        id: data.id,
        name: data.name,
        type: data.type,
        capacity: Number(data.capacity),
        currentLevel: Number(data.current_level),
        safeMinLevel: Number(data.safe_min_level),
        lastUpdated: data.last_updated
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /tanks - Create a new tank
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, type, capacity, currentLevel, safeMinLevel } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Tank name is required' });
    }
    const cleanId = String(name).toUpperCase().trim();
    const row = {
      id: cleanId,
      name: cleanId,
      type: type || 'Jet A-1',
      capacity: Number(capacity) || 0,
      current_level: Number(currentLevel) || 0,
      safe_min_level: Number(safeMinLevel) || 0,
      last_updated: new Date().toISOString()
    };
    const { data, error } = await supabase.from('tanks').insert([row]).select().maybeSingle();
    if (error) {
      console.error('[API] POST /tanks error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ tank: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /tanks/:id - Update tank details / levels
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {
      last_updated: new Date().toISOString()
    };
    if ('name' in updates && updates.name) row.name = updates.name.toUpperCase().trim();
    if ('type' in updates) row.type = updates.type;
    if ('capacity' in updates) row.capacity = Number(updates.capacity);
    if ('currentLevel' in updates) row.current_level = Number(updates.currentLevel);
    if ('safeMinLevel' in updates) row.safe_min_level = Number(updates.safeMinLevel);

    const { error } = await supabase.from('tanks').update(row).eq('id', id);
    if (error) {
      console.error('[API] PATCH /tanks/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, updated: row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /tanks/:id - Delete tank
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('tanks').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /tanks/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: `Tank ${id} deleted` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Calibration charts sub-routes
router.get('/:id/calibration', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('calibration_charts')
      .select('*')
      .eq('tank_id', id)
      .order('height_cm', { ascending: true });
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    const points = (data || []).map(row => ({
      id: row.id,
      tankId: row.tank_id,
      heightCm: Number(row.height_cm),
      volumeLiters: Number(row.volume_liters)
    }));
    return res.json({ points });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/:id/calibration', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { heightCm, volumeLiters } = req.body;
    const row = {
      tank_id: id,
      height_cm: Number(heightCm),
      volume_liters: Number(volumeLiters)
    };
    const { data, error } = await supabase.from('calibration_charts').insert([row]).select().maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ point: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.delete('/:id/calibration/:pointId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { pointId } = req.params;
    const { error } = await supabase.from('calibration_charts').delete().eq('id', pointId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
