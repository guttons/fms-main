import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /settings/service-tank
router.get('/service-tank', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'service_tank')
      .maybeSingle();

    if (error) {
      console.warn('[API] getServiceTank failed:', error);
      return res.json({ tankId: null });
    }
    if (data && data.value && typeof data.value === 'object' && 'tankId' in data.value) {
      return res.json({ tankId: (data.value as any).tankId });
    }
    return res.json({ tankId: null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /settings/service-tank
router.post('/service-tank', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tankId } = req.body;
    if (!tankId) {
      return res.status(400).json({ error: 'tankId is required' });
    }

    const { error } = await supabase.from('app_settings').upsert({
      key: 'service_tank',
      value: { tankId },
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('[API] setServiceTank failed:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, tankId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
