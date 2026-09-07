import { supabase } from '../supabase';

interface StaffAuthRecord {
  staff_id: string;
  password_hash: string;
  salt: string;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string | null;
  last_password_change?: string;
}

class StaffAuthService {
  /**
   * Generates a secure random salt (hex string)
   */
  private generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashes a password string with a salt using Web Crypto SHA-256
   */
  private async hashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Checks if an individual staff member already has a password set
   */
  async hasPassword(staffId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('staff_passwords')
        .select('staff_id')
        .eq('staff_id', staffId)
        .maybeSingle();

      if (!error && data) return true;

      // Fallback check in local storage if Supabase table is not yet created
      const local = localStorage.getItem(`fms_staff_pwd_${staffId}`);
      if (local) return true;

      return false;
    } catch (err) {
      console.warn('[StaffAuthService] hasPassword check fallback:', err);
      return !!localStorage.getItem(`fms_staff_pwd_${staffId}`);
    }
  }

  /**
   * Verifies the staff password
   */
  async verifyPassword(staffId: string, plainText: string): Promise<{ 
    success: boolean; 
    error?: string; 
    mustChange?: boolean;
    isLocked?: boolean;
    lockedUntil?: Date;
  }> {
    if (!plainText || !plainText.trim()) {
      return { success: false, error: 'Password is required' };
    }

    try {
      let record: StaffAuthRecord | null = null;

      // 1. Try Supabase
      const { data, error } = await supabase
        .from('staff_passwords')
        .select('*')
        .eq('staff_id', staffId)
        .maybeSingle();

      if (!error && data) {
        record = data as StaffAuthRecord;
      } else {
        // Check local storage fallback
        const local = localStorage.getItem(`fms_staff_pwd_${staffId}`);
        if (local) {
          try {
            record = JSON.parse(local);
          } catch (_) {}
        }
      }

      if (!record) {
        return { success: false, error: 'No password set for this staff member' };
      }

      // 2. Check if account is locked
      if (record.locked_until && new Date(record.locked_until) > new Date()) {
        return { 
          success: false, 
          error: `Account is temporarily locked until ${new Date(record.locked_until).toLocaleTimeString()}`,
          isLocked: true,
          lockedUntil: new Date(record.locked_until)
        };
      }

      // 3. Verify hash
      const computedHash = await this.hashPassword(plainText, record.salt);
      const isMatch = computedHash === record.password_hash;

      if (!isMatch) {
        const attempts = (record.failed_attempts || 0) + 1;
        const updates: any = { failed_attempts: attempts };
        let isLocked = false;
        let lockedUntilDate: Date | undefined;

        if (attempts >= 5) {
          lockedUntilDate = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
          updates.locked_until = lockedUntilDate.toISOString();
          isLocked = true;
        }

        // Update in Supabase
        await supabase
          .from('staff_passwords')
          .update(updates)
          .eq('staff_id', staffId);

        // Update in local storage
        try {
          const updatedRecord = { ...record, ...updates };
          localStorage.setItem(`fms_staff_pwd_${staffId}`, JSON.stringify(updatedRecord));
        } catch (_) {}

        if (isLocked) {
          return {
            success: false,
            error: 'Account locked due to 5 consecutive failed attempts. Try again in 15 minutes.',
            isLocked: true,
            lockedUntil: lockedUntilDate
          };
        }

        const remaining = 5 - attempts;
        return { 
          success: false, 
          error: `Invalid password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` 
        };
      }

      // 4. Success — reset failed attempts
      await supabase
        .from('staff_passwords')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('staff_id', staffId);

      try {
        const updatedRecord = { ...record, failed_attempts: 0, locked_until: null };
        localStorage.setItem(`fms_staff_pwd_${staffId}`, JSON.stringify(updatedRecord));
      } catch (_) {}

      return { 
        success: true, 
        mustChange: record.must_change_password || false 
      };

    } catch (err: any) {
      console.error('[StaffAuthService] Verification error:', err);
      return { success: false, error: err?.message || 'Authentication error' };
    }
  }

  /**
   * Sets or updates an individual staff member's password
   */
  async setPassword(staffId: string, newPassword: string, mustChange = false): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long' };
    }

    try {
      const salt = this.generateSalt();
      const passwordHash = await this.hashPassword(newPassword, salt);

      const record: StaffAuthRecord = {
        staff_id: staffId,
        password_hash: passwordHash,
        salt: salt,
        must_change_password: mustChange,
        failed_attempts: 0,
        locked_until: null,
        last_password_change: new Date().toISOString()
      };

      // 1. Save to Supabase
      const { error } = await supabase
        .from('staff_passwords')
        .upsert({
          staff_id: record.staff_id,
          password_hash: record.password_hash,
          salt: record.salt,
          must_change_password: record.must_change_password,
          failed_attempts: record.failed_attempts,
          locked_until: record.locked_until,
          last_password_change: record.last_password_change,
          updated_at: new Date().toISOString()
        }, { onConflict: 'staff_id' });

      if (error) {
        console.warn('[StaffAuthService] Supabase upsert failed (will save locally):', error.message);
      }

      // 2. Save locally for resilience
      try {
        localStorage.setItem(`fms_staff_pwd_${staffId}`, JSON.stringify(record));
      } catch (_) {}

      return { success: true };
    } catch (err: any) {
      console.error('[StaffAuthService] Set password error:', err);
      return { success: false, error: err?.message || 'Failed to save password' };
    }
  }

  /**
   * Resets a staff member's password (e.g. by supervisor or admin)
   */
  async resetStaffPassword(staffId: string, tempPassword = 'macl'): Promise<{ success: boolean; error?: string }> {
    return this.setPassword(staffId, tempPassword, true);
  }
}

export const staffAuthService = new StaffAuthService();
