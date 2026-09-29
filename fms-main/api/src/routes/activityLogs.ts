import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /activity-logs
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { module, action, userId, limit = '100' } = req.query;
    let query = supabase
      .from('system_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (module) query = query.eq('module', String(module));
    if (action) query = query.eq('action', String(action));
    if (userId) query = query.eq('user_id', String(userId));

    const { data, error } = await query;
    if (error) {
      console.warn('[API] GET /activity-logs warning:', error.message);
      return res.json({ logs: [] });
    }

    return res.json({ logs: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /activity-logs
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = req.body;
    const row = {
      user_id: log.userId || (req as any).user?.id || 'system',
      user_name: log.userName || (req as any).user?.name || 'System User',
      user_role: log.userRole || (req as any).user?.role || 'SYSTEM',
      employee_id: log.employeeId || null,
      module: log.module,
      action: log.action,
      entity_type: log.entityType || null,
      entity_id: log.entityId || null,
      entity_label: log.entityLabel || null,
      description: log.description,
      before_state: log.beforeState || null,
      after_state: log.afterState || null,
      metadata: log.metadata || null,
      session_id: log.sessionId || null,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('system_activity_logs').insert([row]).select().maybeSingle();
    if (error) {
      console.warn('[API] POST /activity-logs error:', error.message);
      return res.status(200).json({ success: false, error: error.message });
    }

    return res.status(201).json({ success: true, log: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
