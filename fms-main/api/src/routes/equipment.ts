import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToEquipment(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    currentVolume: Number(row.current_volume) || 0,
    maxCapacity: Number(row.max_capacity) || 0,
    lastUpdated: row.last_updated,
    maintenanceDetails: row.maintenance_details
  };
}

// GET /equipment
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('equipment').select('*').order('name');
    if (error) {
      console.error('[API] GET /equipment error:', error);
      return res.status(500).json({ error: error.message });
    }
    const equipment = (data || []).map(mapRowToEquipment);
    return res.json({ equipment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /equipment
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, type, status, currentVolume, maxCapacity, maintenanceDetails } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Equipment name is required' });
    }
    const cleanId = String(name).toUpperCase().trim();
    const row = {
      id: cleanId,
      name: cleanId,
      type: type || 'Refueller',
      status: status || 'Available',
      current_volume: Number(currentVolume) || 0,
      max_capacity: Number(maxCapacity) || 0,
      maintenance_details: maintenanceDetails || null,
      last_updated: new Date().toISOString()
    };

    const { data, error } = await supabase.from('equipment').insert([row]).select().maybeSingle();
    if (error) {
      console.error('[API] POST /equipment error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ equipment: mapRowToEquipment(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /equipment/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const row: Record<string, any> = {
      last_updated: new Date().toISOString()
    };
    if ('name' in updates && updates.name) row.name = updates.name;
    if ('type' in updates) row.type = updates.type;
    if ('status' in updates) row.status = updates.status;
    if ('currentVolume' in updates) row.current_volume = Number(updates.currentVolume);
    if ('maxCapacity' in updates) row.max_capacity = Number(updates.maxCapacity);
    if ('maintenanceDetails' in updates) row.maintenance_details = updates.maintenanceDetails;

    const { data, error } = await supabase.from('equipment').update(row).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[API] PATCH /equipment/:id error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, equipment: data ? mapRowToEquipment(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /equipment/:id/status - Quick status update
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const row = {
      status,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase.from('equipment').update(row).eq('id', id);
    if (error) {
      console.error('[API] PATCH /equipment/:id/status error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, id, status });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /equipment/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /equipment/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
