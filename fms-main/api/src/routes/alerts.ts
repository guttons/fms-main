import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

function mapRowToAlert(row: any) {
  return {
    id: row.id,
    severity: row.severity,
    message: row.message,
    timestamp: row.timestamp,
    acknowledged: !!row.acknowledged,
    acknowledgedAt: row.acknowledged_at || null,
    acknowledgedBy: row.acknowledged_by || null,
    targetRole: row.target_role || null,
    alertType: row.alert_type || null,
    flightNumber: row.flight_number || null,
    flightDate: row.flight_date || null,
    assignedStaffId: row.assigned_staff_id || null,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    senderId: row.sender_id || null,
    senderName: row.sender_name || null
  };
}

// GET /alerts — returns last 2 days worth of alerts (handles night-shift midnight overlap)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { limit = '200', unacknowledgedOnly } = req.query;

    // Rolling 2-day window: today + yesterday to handle overnight/night-shift
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    let query = supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(Number(limit));

    // Prefer date-column filtering when flight_date is present; fall back gracefully
    // (rows inserted before the migration have flight_date = NULL; those come through unfiltered)
    query = query.or(`flight_date.gte.${twoDaysAgo},flight_date.is.null`);

    if (unacknowledgedOnly === 'true') {
      query = query.eq('acknowledged', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API] GET /alerts error:', error);
      return res.status(500).json({ error: error.message });
    }

    const alerts = (data || []).map(mapRowToAlert);
    return res.json({ alerts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /alerts
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const alert = req.body;
    if (!alert.message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Determine operational date: prefer explicit flightDate, fall back to today
    const flightDate = alert.flightDate
      || (alert.timestamp ? new Date(alert.timestamp).toISOString().split('T')[0] : null)
      || new Date().toISOString().split('T')[0];

    const row: Record<string, any> = {
      severity: alert.severity || 'low',
      message: alert.message,
      timestamp: alert.timestamp || new Date().toISOString(),
      acknowledged: false,
      target_role: alert.targetRole || null,
      alert_type: alert.alertType || null,
      flight_number: alert.flightNumber || null,
      flight_date: flightDate,
      assigned_staff_id: alert.assignedStaffId || null,
      metadata: alert.metadata ? JSON.stringify(alert.metadata) : null,
      sender_id: alert.senderId || null,
      sender_name: alert.senderName || null
    };

    const { data, error } = await supabase.from('alerts').insert([row]).select().maybeSingle();
    if (error) {
      // If flight_date column doesn't exist yet (pre-migration), strip it and retry
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('flight_date')) {
        const { flight_date: _fd, ...rowWithoutDate } = row;
        const fallbackRes = await supabase.from('alerts').insert([rowWithoutDate]).select().maybeSingle();
        if (fallbackRes.error) {
          // Last-resort: minimal columns only
          const minimalRow = {
            severity: alert.severity || 'low',
            message: alert.message,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            target_role: alert.targetRole || null
          };
          const minimalRes = await supabase.from('alerts').insert([minimalRow]).select().maybeSingle();
          if (minimalRes.error) {
            return res.status(500).json({ error: minimalRes.error.message });
          }
          return res.status(201).json({ alert: mapRowToAlert(minimalRes.data || minimalRow) });
        }
        return res.status(201).json({ alert: mapRowToAlert(fallbackRes.data || rowWithoutDate) });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ alert: mapRowToAlert(data || row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /alerts/:id/acknowledge
router.patch('/:id/acknowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy, acknowledgedAt } = req.body;

    const payload: Record<string, any> = {
      acknowledged: true,
      acknowledged_at: acknowledgedAt || new Date().toISOString()
    };
    if (acknowledgedBy) {
      payload.acknowledged_by = acknowledgedBy;
    }

    const { error } = await supabase.from('alerts').update(payload).eq('id', id);
    if (error) {
      // Fallback if acknowledged_at column doesn't exist
      await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /alerts/acknowledge-bulk
router.post('/acknowledge-bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ids, acknowledgedBy, acknowledgedAt } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const payload: Record<string, any> = {
      acknowledged: true,
      acknowledged_at: acknowledgedAt || new Date().toISOString()
    };
    if (acknowledgedBy) {
      payload.acknowledged_by = acknowledgedBy;
    }

    const { error } = await supabase.from('alerts').update(payload).in('id', ids);
    if (error) {
      await supabase.from('alerts').update({ acknowledged: true }).in('id', ids);
    }

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /alerts/delete-bulk
router.post('/delete-bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const { error } = await supabase.from('alerts').delete().in('id', ids);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, count: ids.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
