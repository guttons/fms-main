import { useState, useEffect, useCallback } from 'react';
import { roleService, PermissionMatrix } from '../services/roleService';
import { UserRole } from '../types';

export function useRolePermissions(role?: UserRole | string) {
  // Synchronous initial state from local cache so there is zero render delay or menu flicker
  const [permissions, setPermissions] = useState<PermissionMatrix>(() => {
    return role ? roleService.getPermissionsSync(role) : {};
  });
  const [loading, setLoading] = useState<boolean>(false);

  const reloadPermissions = useCallback(async () => {
    if (!role) {
      setPermissions({});
      return;
    }
    // Update immediately from sync cache
    const sync = roleService.getPermissionsSync(role);
    setPermissions(sync);

    // Then revalidate from remote/Supabase
    try {
      const remote = await roleService.getPermissionsForRole(role);
      if (remote && Object.keys(remote).length > 0) {
        setPermissions(remote);
      }
    } catch {}
  }, [role]);

  useEffect(() => {
    reloadPermissions();

    // Listen for custom events dispatched when admin saves roles
    const handlePermissionsUpdated = () => {
      reloadPermissions();
    };

    // Listen for storage events (changes in other browser tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fms_role_permissions_v1' || e.key === 'fms_permissions_last_updated') {
        reloadPermissions();
      }
    };

    window.addEventListener('fms:role-permissions-changed', handlePermissionsUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('fms:role-permissions-changed', handlePermissionsUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [role, reloadPermissions]);

  const canView = useCallback((moduleKey: string): boolean => {
    if (!role) return false;
    if (role === UserRole.ADMIN) return true;
    if (permissions[moduleKey] !== undefined) {
      return !!permissions[moduleKey].canView;
    }
    const sync = roleService.getPermissionsSync(role);
    if (sync[moduleKey] !== undefined) {
      return !!sync[moduleKey].canView;
    }
    return false;
  }, [role, permissions]);

  const canEdit = useCallback((moduleKey: string): boolean => {
    if (!role) return false;
    if (role === UserRole.ADMIN) return true;
    if (permissions[moduleKey] !== undefined) {
      return !!permissions[moduleKey].canEdit;
    }
    const sync = roleService.getPermissionsSync(role);
    if (sync[moduleKey] !== undefined) {
      return !!sync[moduleKey].canEdit;
    }
    return false;
  }, [role, permissions]);

  return { permissions, canView, canEdit, loading, reloadPermissions };
}
