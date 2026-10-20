import { supabase } from '../supabase';
import { serverTimeService } from './serverTimeService';
import { apiFetch, setStaffAuthToken } from './apiClient';

interface StaffAuthRecord {
  staff_id: string;
  password_hash: string;
  salt: string;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string | null;
  last_password_change?: string;
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_PREFIX = `pbkdf2_${PBKDF2_ITERATIONS}$`;

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
   * Legacy single-pass SHA-256 hash (retained strictly for transparent migration of existing accounts)
   */
  private async legacyHashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashes a password string with a salt using Web Crypto PBKDF2-SHA256 (100,000 iterations)
   */
  private async hashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${PBKDF2_PREFIX}${hex}`;
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

      // Fallback check in local storage if offline
      const local = localStorage.getItem(`fms_staff_pwd_${staffId}`);
      if (local) return true;

      return false;
    } catch (err) {
      console.warn('[StaffAuthService] hasPassword check fallback:', err);
      return !!localStorage.getItem(`fms_staff_pwd_${staffId}`);
    }
  }

  /**
   * Verifies the staff password using authoritative server time and PBKDF2
   */
  async verifyPassword(staffId: string, plainText: string): Promise<{ 
    success: boolean; 
    error?: string; 
    mustChange?: boolean;
    isLocked?: boolean;
    lockedUntil?: Date;
    token?: string;
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
        // Remove any legacy plaintext hash cache from localStorage when online
        try {
          localStorage.removeItem(`fms_staff_pwd_${staffId}`);
        } catch (_) {}
      } else {
        // Check local storage fallback only when Supabase table is unreachable
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

      const serverNow = serverTimeService.getServerTime();
      const serverEpochMs = serverTimeService.getServerEpochMs();

      // 2. Check if account is locked against authoritative server time
      if (record.locked_until && new Date(record.locked_until) > serverNow) {
        return { 
          success: false, 
          error: `Account is temporarily locked until ${new Date(record.locked_until).toLocaleTimeString()}`,
          isLocked: true,
          lockedUntil: new Date(record.locked_until)
        };
      }

      // 3. Verify hash (supports PBKDF2-100k and transparent upgrade from legacy SHA-256)
      let isMatch = false;
      let needsHashUpgrade = false;

      if (record.password_hash.startsWith(PBKDF2_PREFIX)) {
        const computedPbkdf2 = await this.hashPassword(plainText, record.salt);
        isMatch = computedPbkdf2 === record.password_hash;
      } else {
        const computedLegacy = await this.legacyHashPassword(plainText, record.salt);
        isMatch = computedLegacy === record.password_hash;
        if (isMatch) {
          needsHashUpgrade = true;
        }
      }

      if (!isMatch) {
        const attempts = (record.failed_attempts || 0) + 1;
        const updates: any = { failed_attempts: attempts };
        let isLocked = false;
        let lockedUntilDate: Date | undefined;

        if (attempts >= 5) {
          lockedUntilDate = new Date(serverEpochMs + 15 * 60 * 1000); // 15 mins lock via server time
          updates.locked_until = lockedUntilDate.toISOString();
          isLocked = true;
        }

        // Update in Supabase
        await supabase
          .from('staff_passwords')
          .update(updates)
          .eq('staff_id', staffId);

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

      // 4. Success — reset failed attempts and transparently upgrade hash to PBKDF2 if needed
      const successUpdates: Record<string, any> = {
        failed_attempts: 0,
        locked_until: null,
        updated_at: serverTimeService.getServerIso()
      };

      if (needsHashUpgrade) {
        const upgradedSalt = this.generateSalt();
        successUpdates.salt = upgradedSalt;
        successUpdates.password_hash = await this.hashPassword(plainText, upgradedSalt);
      }

      await supabase
        .from('staff_passwords')
        .update(successUpdates)
        .eq('staff_id', staffId);

      // 5. Request signed Staff JWT from backend API (non-blocking fallback if offline)
      let issuedToken: string | undefined;
      try {
        const tokenRes = await apiFetch<{ success: boolean; token?: string }>('/auth/issue-staff-token', {
          method: 'POST',
          body: JSON.stringify({ staffId })
        });
        if (tokenRes?.token) {
          issuedToken = tokenRes.token;
          setStaffAuthToken(tokenRes.token);
        }
      } catch (_) {
        // Offline or local dev without API running
      }

      return { 
        success: true, 
        mustChange: record.must_change_password || false,
        token: issuedToken
      };

    } catch (err: any) {
      console.error('[StaffAuthService] Verification error:', err);
      return { success: false, error: err?.message || 'Authentication error' };
    }
  }

  /**
   * Sets or updates an individual staff member's password using PBKDF2
   */
  async setPassword(staffId: string, newPassword: string, mustChange = false): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long' };
    }

    try {
      const salt = this.generateSalt();
      const passwordHash = await this.hashPassword(newPassword, salt);
      const nowIso = serverTimeService.getServerIso();

      const record: StaffAuthRecord = {
        staff_id: staffId,
        password_hash: passwordHash,
        salt: salt,
        must_change_password: mustChange,
        failed_attempts: 0,
        locked_until: null,
        last_password_change: nowIso
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
          updated_at: nowIso
        }, { onConflict: 'staff_id' });

      if (error) {
        console.warn('[StaffAuthService] Supabase upsert failed (will save offline fallback):', error.message);
        try {
          localStorage.setItem(`fms_staff_pwd_${staffId}`, JSON.stringify(record));
        } catch (_) {}
      } else {
        try {
          localStorage.removeItem(`fms_staff_pwd_${staffId}`);
        } catch (_) {}
      }

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
