import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToVessel(row: any) {
  return {
    id: row.id,
    name: row.name,
    imo: row.imo || undefined,
    flag: row.flag || undefined,
    status: row.status || 'active',
    created_at: row.created_at
  };
}

// GET /vessels
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('vessels').select('*').order('name');
    if (error) {
      console.error('[API] GET /vessels error:', error);
      return res.status(500).json({ error: error.message });
    }
    const vessels = (data || []).map(mapRowToVessel);
    return res.json({ vessels });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /vessels
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, imo, flag, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Vessel name is required' });
    }

    const row = {
      name: String(name).trim(),
      imo: imo || null,
      flag: flag || null,
      status: status || 'active'
    };

    const { data, error } = await supabase.from('vessels').insert([row]).select().maybeSingle();
    if (error) {
      console.error('[API] POST /vessels error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ vessel: mapRowToVessel(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /vessels/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const row: Record<string, any> = {};
    if ('name' in updates && updates.name) row.name = updates.name.trim();
    if ('imo' in updates) row.imo = updates.imo;
    if ('flag' in updates) row.flag = updates.flag;
    if ('status' in updates) row.status = updates.status;

    const { data, error } = await supabase.from('vessels').update(row).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[API] PATCH /vessels/:id error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, vessel: data ? mapRowToVessel(data) : row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /vessels/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('vessels').delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /vessels/:id error:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
