import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldCheck, Plus, Pencil, Trash2, X, Check, AlertTriangle, 
  Layers, Lock, Eye, Edit3, CheckSquare, Square, Info, Sparkles, RefreshCw
} from 'lucide-react';
import { ALL_MODULES, MODULE_GROUPS, ModuleDefinition } from '../constants/moduleRegistry';
import { roleService, CustomRole, PermissionMatrix } from '../services/roleService';
import { activityLogService, LogModule, LogAction } from '../services/activityLogService';
import { UserRole } from '../types';
import { Logo } from './Logo';

interface RoleManagerTabProps {
  push: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  confirm: (msg: string, cb: () => void) => void;
  currentUser?: any;
}

const COLOR_PRESETS = [
  { label: 'Blue (Primary)', value: 'bg-primary/10 text-primary border-primary/20' },
  { label: 'Amber (Warning)', value: 'bg-warning/10 text-warning border-warning/20' },
  { label: 'Green (Success)', value: 'bg-success/10 text-success border-success/20' },
  { label: 'Purple (Executive)', value: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { label: 'Indigo (Operations)', value: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { label: 'Rose (Restricted)', value: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { label: 'Cyan (Aviation)', value: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
];

export const RoleManagerTab: React.FC<RoleManagerTabProps> = ({ push, confirm, currentUser }) => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [roleCode, setRoleCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [colorClass, setColorClass] = useState(COLOR_PRESETS[0].value);
  const [permissions, setPermissions] = useState<PermissionMatrix>({});

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await roleService.getRoles();
      setRoles(data);
    } catch (e) {
      push('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleCode('');
    setDisplayName('');
    setDescription('');
    setColorClass(COLOR_PRESETS[0].value);
    
    // Default permissions: all unchecked
    const initPerms: PermissionMatrix = {};
    ALL_MODULES.forEach(m => {
      initPerms[m.key] = { canView: false, canEdit: false };
    });
    // Default dashboard view to true
    if (initPerms['dashboard']) initPerms['dashboard'].canView = true;
    
    setPermissions(initPerms);
    setShowModal(true);
  };

  const openEditModal = async (role: CustomRole) => {
    setEditingRole(role);
    setRoleCode(role.name);
    setDisplayName(role.displayName);
    setDescription(role.description || '');
    setColorClass(role.color || COLOR_PRESETS[0].value);

    // Load permissions for this role
    const existingPerms = await roleService.getPermissionsForRole(role.name);
    const completePerms: PermissionMatrix = {};
    ALL_MODULES.forEach(m => {
      completePerms[m.key] = {
        canView: existingPerms[m.key]?.canView ?? false,
        canEdit: existingPerms[m.key]?.canEdit ?? false
      };
    });
    setPermissions(completePerms);
    setShowModal(true);
  };

  const toggleView = (moduleKey: string) => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { canView: false, canEdit: false };
      const nextView = !current.canView;
      // If turning off view, also turn off edit
      return {
        ...prev,
        [moduleKey]: {
          canView: nextView,
          canEdit: nextView ? current.canEdit : false
        }
      };
    });
  };

  const toggleEdit = (moduleKey: string) => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { canView: false, canEdit: false };
      const nextEdit = !current.canEdit;
      // If turning on edit, view must also be turned on
      return {
        ...prev,
        [moduleKey]: {
          canView: nextEdit ? true : current.canView,
          canEdit: nextEdit
        }
      };
    });
  };

  const selectAllView = () => {
    setPermissions(prev => {
      const updated: PermissionMatrix = {};
      ALL_MODULES.forEach(m => {
        updated[m.key] = { canView: true, canEdit: prev[m.key]?.canEdit ?? false };
      });
      return updated;
    });
  };

  const selectAllEdit = () => {
    setPermissions(() => {
      const updated: PermissionMatrix = {};
      ALL_MODULES.forEach(m => {
        updated[m.key] = { canView: true, canEdit: true };
      });
      return updated;
    });
  };

  const clearAllPermissions = () => {
    setPermissions(() => {
      const updated: PermissionMatrix = {};
      ALL_MODULES.forEach(m => {
        updated[m.key] = { canView: false, canEdit: false };
      });
      return updated;
    });
  };

  const handleSave = async () => {
    const formattedCode = roleCode.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!formattedCode) {
      push('Role code is required (e.g. QUALITY_CONTROL)', 'error');
      return;
    }
    if (!displayName.trim()) {
      push('Display Name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const saved = await roleService.saveRole(
        {
          id: editingRole?.id,
          name: formattedCode,
          displayName: displayName.trim(),
          color: colorClass,
          description: description.trim()
        },
        permissions,
        currentUser?.name || 'System Admin'
      );

      activityLogService.logAction(currentUser, {
        module: LogModule.SYSTEM_SETTINGS,
        action: editingRole ? LogAction.UPDATE : LogAction.CREATE,
        entity_type: 'custom_role',
        entity_id: saved.id,
        entity_label: saved.displayName,
        description: `${editingRole ? 'Updated' : 'Created'} role ${saved.displayName} (${saved.name}) with customized module permissions`
      });

      push(`Role "${saved.displayName}" saved successfully!`, 'success');
      setShowModal(false);
      loadRoles();
    } catch (e: any) {
      push(e?.message || 'Failed to save role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (role: CustomRole) => {
    if (role.isSystemRole) {
      push('System-defined roles cannot be deleted', 'warning');
      return;
    }

    confirm(`Are you sure you want to delete role "${role.displayName}"? Staff members assigned this role will need to be reassigned.`, async () => {
      try {
        await roleService.deleteRole(role.name);
        activityLogService.logAction(currentUser, {
          module: LogModule.SYSTEM_SETTINGS,
          action: LogAction.DELETE,
          entity_type: 'custom_role',
          entity_id: role.id,
          entity_label: role.displayName,
          description: `Deleted custom role ${role.displayName} (${role.name})`
        });
        push(`Role "${role.displayName}" deleted.`, 'success');
        loadRoles();
      } catch (e) {
        push('Failed to delete role', 'error');
      }
    });
  };

  const getModulePermissionCount = (roleName: string) => {
    // Return approximate count or indicator
    return ALL_MODULES.length;
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-on-surface uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            ROLE PERMISSION & ACCESS MANAGER
          </h2>
          <p className="text-xs text-on-surface-dim mt-0.5">
            Create custom system roles, attach specific modules, and grant granular View or Edit privileges.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadRoles}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low hover:bg-surface-container border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest text-on-surface hover:text-primary transition-all active:scale-95"
            title="Refresh roles"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-premium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Create New Role
          </button>
        </div>
      </div>

      {/* Role Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Logo className="w-12 h-12 text-primary animate-pulse" />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-dim opacity-50 border border-dashed border-outline rounded-3xl p-8 text-center">
          <ShieldCheck className="w-12 h-12 mb-3 text-primary opacity-30" />
          <p className="text-sm font-black uppercase tracking-widest text-on-surface">No Roles Found</p>
          <p className="text-xs mt-1">Create your first role using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(r => (
            <div
              key={r.id}
              className="bg-surface-container-low border border-outline/60 hover:border-primary/40 rounded-3xl p-5 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest ${r.color || 'bg-primary/10 text-primary border-primary/20'}`}>
                    {r.name}
                  </span>
                  {r.isSystemRole && (
                    <span className="text-[8.5px] font-mono font-bold text-on-surface-dim/60 bg-surface px-2 py-0.5 rounded-lg border border-outline/30 uppercase tracking-widest">
                      Core Role
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-on-surface uppercase tracking-tight mb-1">
                  {r.displayName}
                </h3>
                <p className="text-xs text-on-surface-dim/80 line-clamp-2 mb-4 leading-relaxed">
                  {r.description || 'Custom role with tailored operational and reporting privileges.'}
                </p>
              </div>

              <div className="pt-3 border-t border-outline/40 flex items-center justify-between">
                <span className="text-[10px] font-mono text-on-surface-dim/70 flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-primary" />
                  Granular Permissions Active
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(r)}
                    className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-90"
                    title="Configure module permissions"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!r.isSystemRole && (
                    <button
                      onClick={() => handleDelete(r)}
                      className="p-2 rounded-xl hover:bg-error/10 text-error transition-all active:scale-90"
                      title="Delete role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREATE / EDIT ROLE MODAL WITH GRANULAR PERMISSIONS MATRIX
         ───────────────────────────────────────────────────────────── */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setShowModal(false)}
          />
          <div 
            className="relative bg-surface border border-outline rounded-3xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden z-10 my-auto animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline/60 bg-surface-dim/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">
                    {editingRole ? `Configure Role: ${editingRole.displayName}` : 'Create New System Role'}
                  </h3>
                  <p className="text-[10px] text-on-surface-dim font-bold uppercase tracking-widest mt-0.5">
                    Define role identity and assign per-module View / Edit rights
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-surface-container text-on-surface-dim hover:text-on-surface transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
              
              {/* Role Metadata Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline/50">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                    Role Code / Enum Key <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingRole?.isSystemRole}
                    value={roleCode}
                    onChange={e => setRoleCode(e.target.value.toUpperCase().replace(/[\s-]+/g, '_'))}
                    placeholder="e.g. QUALITY_CONTROL"
                    className="w-full bg-surface rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-on-surface outline-none border border-outline/60 focus:border-primary transition-all disabled:opacity-60"
                  />
                  <span className="text-[9.5px] text-on-surface-dim/60 block">Used internally for RBAC authorization</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                    Display Label <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Quality Control Inspector"
                    className="w-full bg-surface rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface outline-none border border-outline/60 focus:border-primary transition-all"
                  />
                  <span className="text-[9.5px] text-on-surface-dim/60 block">Human-readable name shown in staff dropdowns</span>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                    Role Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe role scope and operational duties..."
                    className="w-full bg-surface rounded-xl px-4 py-2.5 text-xs font-medium text-on-surface outline-none border border-outline/60 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                    Badge Color Scheme
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setColorClass(preset.value)}
                        className={`px-3 py-1.5 rounded-xl border text-[9.5px] font-black uppercase tracking-wider transition-all ${preset.value} ${
                          colorClass === preset.value ? 'ring-2 ring-primary scale-105 shadow-sm' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Module Permissions Matrix */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-outline/50">
                  <div>
                    <h4 className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" /> Module Rights Matrix
                    </h4>
                    <p className="text-[10.5px] text-on-surface-dim">
                      Select which modules this role can view, and whether they can edit data inside each module.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllView}
                      className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline rounded-lg text-[9px] font-black uppercase tracking-wider text-on-surface hover:text-primary transition-all active:scale-95"
                    >
                      Enable All Views
                    </button>
                    <button
                      type="button"
                      onClick={selectAllEdit}
                      className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline rounded-lg text-[9px] font-black uppercase tracking-wider text-on-surface hover:text-primary transition-all active:scale-95"
                    >
                      Enable All Edits
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline rounded-lg text-[9px] font-black uppercase tracking-wider text-error/80 hover:text-error transition-all active:scale-95"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Modules list grouped */}
                <div className="space-y-5">
                  {MODULE_GROUPS.map(group => {
                    const groupModules = ALL_MODULES.filter(m => m.group === group);
                    return (
                      <div key={group} className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 bg-primary/5 px-3 py-1 rounded-lg w-fit">
                          {group}
                        </div>

                        <div className="overflow-hidden border border-outline/60 rounded-2xl divide-y divide-outline/40">
                          {groupModules.map(mod => {
                            const isView = !!permissions[mod.key]?.canView;
                            const isEdit = !!permissions[mod.key]?.canEdit;

                            return (
                              <div
                                key={mod.key}
                                className={`flex items-center justify-between p-3.5 transition-colors ${
                                  isView ? 'bg-surface-container-lowest/60' : 'bg-surface/30 opacity-70'
                                }`}
                              >
                                <div className="pr-4 min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-on-surface uppercase tracking-tight">
                                      {mod.label}
                                    </span>
                                    <span className="text-[9px] font-mono text-on-surface-dim/60 bg-surface-dim px-1.5 py-0.5 rounded">
                                      {mod.key}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-on-surface-dim mt-0.5 truncate">
                                    {mod.description}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {/* View Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => toggleView(mod.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                      isView
                                        ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-surface border-outline/50 text-on-surface-dim/60 hover:text-on-surface'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>

                                  {/* Edit Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => toggleEdit(mod.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                      isEdit
                                        ? 'bg-warning/10 text-warning border-warning/30 ring-1 ring-warning/20'
                                        : 'bg-surface border-outline/50 text-on-surface-dim/60 hover:text-on-surface'
                                    }`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-outline/60 bg-surface-dim/30 shrink-0">
              <span className="text-[10px] font-mono text-on-surface-dim flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                Changes apply instantly across client sessions
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline text-[11px] font-black uppercase tracking-widest text-on-surface hover:text-primary transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl kinetic-gradient text-white text-[11px] font-black uppercase tracking-widest shadow-premium hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingRole ? 'Save Role Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
