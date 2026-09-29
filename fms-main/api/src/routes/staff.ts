import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToStaff(row: any) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    employeeId: row.employee_id,
    phone: row.phone || undefined,
    email: row.email || undefined,
    status: row.status || 'active',
    joinDate: row.join_date || row.created_at || new Date().toISOString(),
    avatar: row.avatar || undefined,
    currentStatus: row.current_status || 'OFFLINE',
    currentJobId: row.current_job_id || undefined,
    currentVehicleId: row.current_vehicle_id || undefined,
    lastActiveAt: row.last_active_at || undefined,
    currentLocation: row.current_location || undefined
  };
}

// GET /staff
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (error) {
      console.error('[API] GET /staff error:', error);
      return res.status(500).json({ error: error.message });
    }
    const staff = (data || []).map(mapRowToStaff);
    return res.json({ staff });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /staff/find?identifier=...
router.get('/find', requireAuth, async (req: Request, res: Response) => {
  try {
    const { identifier } = req.query;
    if (!identifier) {
      return res.status(400).json({ error: 'identifier is required' });
    }
    const clean = String(identifier).trim().toLowerCase();
    const cleanStripped = clean.replace('-', '');

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .or(`employee_id.ilike.${clean},employee_id.ilike.${cleanStripped},email.ilike.${clean}`);

    if (error) {
      console.error('[API] GET /staff/find error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    return res.json({ staff: mapRowToStaff(data[0]) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /staff
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const member = req.body;
    if (!member.name || !member.role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    const newId = member.id || `st-${Date.now()}`;
    const avatar = member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`;

    const row = {
      id: newId,
      name: member.name,
      role: member.role,
      employee_id: member.employeeId || null,
      phone: member.phone || null,
      email: member.email || null,
      status: member.status || 'active',
      avatar
    };

    const { data, error } = await supabase.from('staff').insert([row]).select().maybeSingle();
    if (error) {
      console.error('[API] POST /staff error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ staff: mapRowToStaff(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /staff/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const row: Record<string, any> = {};
    if ('name' in updates) row.name = updates.name;
    if ('role' in updates) row.role = updates.role;
    if ('employeeId' in updates) row.employee_id = updates.employeeId;
    if ('phone' in updates) row.phone = updates.phone;
    if ('email' in updates) row.email = updates.email;
    if ('status' in updates) row.status = updates.status;
    if ('avatar' in updates) row.avatar = updates.avatar;
    if ('currentStatus' in updates) row.current_status = updates.currentStatus;
    if ('currentJobId' in updates) row.current_job_id = updates.currentJobId;
    if ('currentVehicleId' in updates) row.current_vehicle_id = updates.currentVehicleId;
    if ('currentLocation' in updates) row.current_location = updates.currentLocation;
    if ('lastActiveAt' in updates) row.last_active_at = updates.lastActiveAt;

    const { data, error } = await supabase.from('staff').update(row).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[API] PATCH /staff/:id error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, staff: data ? mapRowToStaff(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /staff/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /staff/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
