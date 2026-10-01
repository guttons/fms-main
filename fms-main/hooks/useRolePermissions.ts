import { useState, useEffect } from 'react';
import { roleService, PermissionMatrix } from '../services/roleService';
import { UserRole } from '../types';

export function useRolePermissions(role?: UserRole | string) {
  const [permissions, setPermissions] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!role) {
      setPermissions({});
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    roleService.getPermissionsForRole(role).then(matrix => {
      if (isMounted) {
        setPermissions(matrix || {});
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [role]);

  const canView = (moduleKey: string): boolean => {
    if (role === UserRole.ADMIN) return true;
    return permissions[moduleKey]?.canView ?? false;
  };

  const canEdit = (moduleKey: string): boolean => {
    if (role === UserRole.ADMIN) return true;
    return permissions[moduleKey]?.canEdit ?? false;
  };

  return { permissions, canView, canEdit, loading };
}
