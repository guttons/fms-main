import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /shift-briefing
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, shift } = req.query;
    if (!date || !shift) {
      return res.status(400).json({ error: 'date and shift query params are required' });
    }
    const docId = `${date}_${shift}`;
    const { data, error } = await supabase
      .from('shift_briefing_info')
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      return res.json({
        briefing: {
          info: data.info || [],
          dieselNeeds: data.diesel_needs || [],
          staffAssignments: data.staff_assignments || null
        }
      });
    }

    return res.json({
      briefing: {
        info: [],
        dieselNeeds: [],
        staffAssignments: null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /shift-briefing
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, shift, info, dieselNeeds, staffAssignments } = req.body;
    if (!date || !shift) {
      return res.status(400).json({ error: 'date and shift are required' });
    }

    const docId = `${date}_${shift}`;
    const row = {
      id: docId,
      date,
      shift,
      info: info || [],
      diesel_needs: dieselNeeds || [],
      staff_assignments: staffAssignments || null
    };

    const { error } = await supabase.from('shift_briefing_info').upsert(row);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, id: docId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE /shift-briefing
router.delete('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('shift_briefing_info').delete().neq('id', '');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: 'All shift briefing info cleared' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Domestic Assignments ─────────────────────────────────────────────────────
router.get('/assignments/domestic', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const { data, error } = await supabase
      .from('domestic_assignments')
      .select('*')
      .eq('assignment_date', String(date));

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ assignments: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/assignments/domestic', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, teamName, op1, op2 } = req.body;
    if (!date || !teamName) return res.status(400).json({ error: 'date and teamName are required' });

    const docId = `${date}_${teamName}`;
    const row = {
      id: docId,
      assignment_date: date,
      team_name: teamName,
      operator1_id: op1,
      operator2_id: op2
    };

    const { error } = await supabase.from('domestic_assignments').upsert(row);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id: docId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Equipment Assignments ────────────────────────────────────────────────────
router.get('/assignments/equipment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, shiftType } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    let query = supabase.from('equipment_assignments').select('*').eq('assignment_date', String(date));
    if (shiftType) query = query.eq('shift_type', String(shiftType));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ assignments: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/assignments/equipment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date, eqId, shiftType, op1, op2 } = req.body;
    if (!date || !eqId || !shiftType) return res.status(400).json({ error: 'date, eqId, and shiftType are required' });

    const docId = `${date}_${eqId}_${shiftType}`;
    const row = {
      id: docId,
      assignment_date: date,
      equipment_id: eqId,
      shift_type: shiftType,
      operator1_id: op1,
      operator2_id: op2
    };

    const { error } = await supabase.from('equipment_assignments').upsert(row);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id: docId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
