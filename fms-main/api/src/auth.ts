import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple PIN hashing using crypto.scrypt (Node built-in, no external deps needed)
const hashPin = async (pin: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};

const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
};

// POST /auth/set-pin
// Body: { staffId: string, pin: string, isFirstTime?: boolean }
router.post('/set-pin', async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) {
      return res.status(400).json({ error: 'staffId and pin are required' });
    }
    
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const pinHash = await hashPin(pin);

    const { error } = await supabase
      .from('staff_auth')
      .upsert({
        staff_id: staffId,
        pin_hash: pinHash,
        must_change_pin: false,
        failed_attempts: 0,
        locked_until: null,
        reset_token: null,
        reset_token_expires: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'staff_id' });

    if (error) {
      console.error('[Auth] Error setting PIN:', error);
      return res.status(500).json({ error: 'Failed to set PIN' });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] set-pin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify-pin  
// Body: { staffId: string, pin: string }
router.post('/verify-pin', async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) {
      return res.status(400).json({ error: 'staffId and pin are required' });
    }

    const { data: authRecord, error } = await supabase
      .from('staff_auth')
      .select('*')
      .eq('staff_id', staffId)
      .single();

    if (error || !authRecord) {
      return res.status(404).json({ error: 'Auth record not found' });
    }

    if (authRecord.locked_until && new Date(authRecord.locked_until) > new Date()) {
      return res.status(403).json({ 
        error: 'Account locked', 
        lockedUntil: authRecord.locked_until 
      });
    }

    const isValid = await verifyPin(pin, authRecord.pin_hash);

    if (!isValid) {
      const attempts = (authRecord.failed_attempts || 0) + 1;
      const updateData: any = { failed_attempts: attempts };
      
      if (attempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
      }

      await supabase
        .from('staff_auth')
        .update(updateData)
        .eq('staff_id', staffId);

      return res.status(401).json({ 
        error: 'Invalid PIN', 
        attemptsRemaining: 5 - attempts,
        locked: attempts >= 5
      });
    }

    // Success
    await supabase
      .from('staff_auth')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('staff_id', staffId);

    return res.json({ 
      success: true, 
      mustChangePin: authRecord.must_change_pin 
    });

  } catch (err: any) {
    console.error('[Auth] verify-pin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/check-auth-status
// Body: { staffId: string }
router.post('/check-auth-status', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }

    const { data: authRecord, error } = await supabase
      .from('staff_auth')
      .select('must_change_pin, locked_until')
      .eq('staff_id', staffId)
      .single();

    if (error) {
      // Record might not exist for first-time users
      return res.json({ hasPin: false });
    }

    const isLocked = authRecord.locked_until ? new Date(authRecord.locked_until) > new Date() : false;

    return res.json({
      hasPin: true,
      mustChangePin: authRecord.must_change_pin,
      isLocked,
      lockedUntil: authRecord.locked_until
    });
  } catch (err: any) {
    console.error('[Auth] check-auth-status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset-pin (admin action)
// Body: { staffId: string }
router.post('/reset-pin', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }

    const { error } = await supabase
      .from('staff_auth')
      .delete()
      .eq('staff_id', staffId);

    if (error) {
      return res.status(500).json({ error: 'Failed to reset PIN' });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] reset-pin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/forgot-pin
// Body: { staffId: string, email: string }
router.post('/forgot-pin', async (req, res) => {
  try {
    const { staffId, email } = req.body;
    if (!staffId || !email) {
      return res.status(400).json({ error: 'staffId and email are required' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error } = await supabase
      .from('staff_auth')
      .update({
        reset_token: resetToken,
        reset_token_expires: expires
      })
      .eq('staff_id', staffId);

    if (error) {
      // Create if doesn't exist? No, if forgot PIN, they must have had one.
      return res.status(500).json({ error: 'Failed to initiate reset' });
    }

    // In real system, send email here. 
    return res.json({ success: true, token: resetToken });
  } catch (err: any) {
    console.error('[Auth] forgot-pin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset-with-token
// Body: { staffId: string, token: string, newPin: string }
router.post('/reset-with-token', async (req, res) => {
  try {
    const { staffId, token, newPin } = req.body;
    if (!staffId || !token || !newPin) {
      return res.status(400).json({ error: 'staffId, token, and newPin are required' });
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const { data: authRecord, error } = await supabase
      .from('staff_auth')
      .select('reset_token, reset_token_expires')
      .eq('staff_id', staffId)
      .single();

    if (error || !authRecord) {
      return res.status(400).json({ error: 'Invalid reset request' });
    }

    if (authRecord.reset_token !== token) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    if (new Date(authRecord.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    const pinHash = await hashPin(newPin);

    const { error: updateError } = await supabase
      .from('staff_auth')
      .update({
        pin_hash: pinHash,
        reset_token: null,
        reset_token_expires: null,
        failed_attempts: 0,
        locked_until: null,
        must_change_pin: false
      })
      .eq('staff_id', staffId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to reset PIN' });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] reset-with-token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
