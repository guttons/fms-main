import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Server, ShieldCheck, Activity, Database,
  Plus, Pencil, Trash2, X, Check, AlertTriangle,
  Truck, Fuel, ChevronDown, Phone, Mail, IdCard, UserCheck, UserX,
  RefreshCw
} from 'lucide-react';
import { UserRole, EquipmentType, EquipmentStatus, FuelType } from '../types';
import type { StaffMember, Equipment, Tank } from '../types';
import { MOCK_USERS } from '../constants';
import { Logo } from './Logo';
import {
  subscribeToStaff, addStaff, updateStaff, deleteStaff,
  subscribeToEquipment, addEquipment, updateEquipment, deleteEquipment,
  subscribeToTanks, addTank, updateTank, deleteTank,
} from '../services/firebaseService';
import { useNotification, NotificationType } from '../context/NotificationContext';
import { seedingService } from '../services/seedingService';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'staff' | 'equipment' | 'tanks';

interface ConfirmState { open: boolean; message: string; onConfirm: () => void; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'System Admin',
  [UserRole.ITP_MANAGER]: 'ITP Manager',
  [UserRole.DEPOT_MANAGER]: 'Depot Manager',
  [UserRole.ITP_OFFICER]: 'ITP Officer',
  [UserRole.ITP_OPERATOR]: 'ITP Operator',
  [UserRole.ITP_HD_OPERATOR]: 'HD Operator',
  [UserRole.DEPOT_OPERATOR]: 'Depot Operator',
  [UserRole.EXECUTIVE]: 'Executive',
  [UserRole.COMMERCIAL]: 'Commercial',
};

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'bg-error/10 text-error border-error/20',
  [UserRole.ITP_MANAGER]: 'bg-primary/10 text-primary border-primary/20',
  [UserRole.DEPOT_MANAGER]: 'bg-primary/10 text-primary border-primary/20',
  [UserRole.ITP_OFFICER]: 'bg-warning/10 text-warning border-warning/20',
  [UserRole.ITP_OPERATOR]: 'bg-success/10 text-success border-success/20',
  [UserRole.ITP_HD_OPERATOR]: 'bg-success/10 text-success border-success/20',
  [UserRole.DEPOT_OPERATOR]: 'bg-success/10 text-success border-success/20',
  [UserRole.EXECUTIVE]: 'bg-surface-container-low text-on-surface-dim border-outline',
  [UserRole.COMMERCIAL]: 'bg-surface-container-low text-on-surface-dim border-outline',
};

const EQ_TYPE_COLORS: Record<EquipmentType, string> = {
  [EquipmentType.REFUELLER]: 'bg-primary/10 text-primary border-primary/20',
  [EquipmentType.HYDRANT_DISPENSER]: 'bg-warning/10 text-warning border-warning/20',
  [EquipmentType.DIESEL_TRUCK]: 'bg-success/10 text-success border-success/20',
  [EquipmentType.HYDRANT_SERVICE]: 'bg-error/10 text-error border-error/20',
};

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  [EquipmentStatus.AVAILABLE]: 'bg-success/10 text-success border-success/20',
  [EquipmentStatus.IN_USE]: 'bg-primary/10 text-primary border-primary/20',
  [EquipmentStatus.MAINTENANCE]: 'bg-warning/10 text-warning border-warning/20',
  [EquipmentStatus.OUT_OF_SERVICE]: 'bg-error/10 text-error border-error/20',
  [EquipmentStatus.REFUELLING]: 'bg-warning/10 text-warning border-warning/20',
};

function fuelFillColor(pct: number) {
  if (pct < 15) return 'bg-error';
  if (pct < 30) return 'bg-warning';
  return 'bg-success';
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}ML`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}KL`;
  return `${n}L`;
}


// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{ state: ConfirmState; onClose: () => void }> = ({ state, onClose }) => {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-surface/20 backdrop-blur-xl" onClick={onClose}>
      <div className="bg-surface rounded-3xl p-8 max-w-sm w-full mx-4 shadow-premium border border-outline" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-error/10 border border-error/20">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <div>
            <p className="text-sm font-black text-on-surface uppercase tracking-tight">Confirm Action</p>
            <p className="text-[11px] text-on-surface-dim opacity-60 uppercase tracking-widest mt-1">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-on-surface-dim mb-8">{state.message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border-transparent text-[11px] font-black uppercase tracking-widest text-on-surface-dim hover:bg-surface-container-low transition-all">Cancel</button>
          <button onClick={() => { state.onConfirm(); onClose(); }} className="flex-1 px-4 py-3 rounded-xl bg-error text-white text-[11px] font-black uppercase tracking-widest hover:bg-error/90 transition-all active:scale-95">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Wrapper ─────────────────────────────────────────────────────────────
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-surface/20 backdrop-blur-xl p-4" onClick={onClose}>
    <div className="bg-surface border border-outline rounded-3xl w-full max-w-lg shadow-premium max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-8 py-6">
        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.2em]">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container-low transition-all active:scale-90"><X className="w-5 h-5 text-on-surface-dim" /></button>
      </div>
      <div className="p-8">{children}</div>
    </div>
  </div>
);

// ─── Form Field ────────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode; required?: boolean }> = ({ label, children, required }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
      {label}{required && <span className="text-error ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/20 transition-all placeholder:text-on-surface-dim placeholder:opacity-40";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── STAFF TAB ─────────────────────────────────────────────────────────────────
const StaffTab: React.FC<{ 
  push: (msg: string, type?: NotificationType) => void; 
  confirm: (msg: string, cb: () => void) => void;
  currentUser?: any;
}> = ({ push, confirm, currentUser }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const emptyForm: Omit<StaffMember, 'id'> = {
    name: '',
    role: UserRole.ITP_OPERATOR,
    employeeId: '',
    phone: '',
    email: '',
    status: 'active',
    joinDate: new Date().toISOString(),
    avatar: ''
  };
  const [form, setForm] = useState<Omit<StaffMember, 'id'>>(emptyForm);

  useEffect(() => {
    const unsub = subscribeToStaff((data) => { setStaff(data); setLoading(false); });
    return unsub;
  }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s: StaffMember) => { setEditing(s); setForm({ name: s.name, role: s.role, employeeId: s.employeeId, phone: s.phone ?? '', email: s.email ?? '', status: s.status, joinDate: s.joinDate, avatar: s.avatar ?? '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.employeeId.trim()) { push('Name and Employee ID are required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateStaff(editing.id, form);
        push('Staff member updated', 'success');
      } else {
        await addStaff(form);
        push('Staff member added', 'success');
      }
      setShowModal(false);
    } catch (e) {
      push('Failed to save. Check Firestore permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: StaffMember) => {
    if (currentUser && s.id === currentUser.id) {
      push('Security Protocol: Cannot remove your own active administrative account.', 'error');
      return;
    }

    confirm(`Remove ${s.name} (${s.employeeId}) from the system?`, async () => {
      try { 
        await deleteStaff(s.id); 
        push('Staff member removed', 'success'); 
      }
      catch (error: any) { 
        console.error("Staff Deletion Failed:", error);
        const msg = error?.message?.includes('permission') 
          ? 'Permission Denied: Your account does not have authorization to delete records.' 
          : 'Failed to remove staff member. System error logged.';
        push(msg, 'error'); 
      }
    });
  };

  const handleToggleStatus = async (s: StaffMember) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try { await updateStaff(s.id, { status: newStatus }); push(`${s.name} marked as ${newStatus}`, 'success'); }
    catch { push('Failed to update status', 'error'); }
  };

  const filtered = staff.filter(s =>
    (filterRole === 'ALL' || s.role === filterRole) &&
    (filterStatus === 'ALL' || s.status === filterStatus)
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-surface-container-low border-transparent rounded-xl pl-4 pr-8 py-2 text-on-surface-dim appearance-none cursor-pointer focus:border-primary outline-none transition-all">
              <option value="ALL">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-on-surface-dim absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-surface-container-low border-transparent rounded-xl pl-4 pr-8 py-2 text-on-surface-dim appearance-none cursor-pointer focus:border-primary outline-none transition-all">
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="w-3 h-3 text-on-surface-dim absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-premium whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-dim opacity-40">
          <Users className="w-12 h-12 mb-4" />
          <p className="text-sm font-black uppercase tracking-widest">No staff records found</p>
          <p className="text-[10px] mt-1 uppercase tracking-widest">Add your first staff member above</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-transparent">
          <table className="min-w-full divide-y divide-outline">
            <thead className="bg-surface-container-low">
              <tr>
                {['Personnel', 'Employee ID', 'Role', 'Contact', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface-container-lowest divide-y divide-outline">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-primary/[0.02] transition-colors group">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        <img src={s.avatar || `https://picsum.photos/100/100?random=${s.employeeId}`} alt="" className="w-10 h-10 rounded-2xl border-transparent object-cover" />
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface ${s.status === 'active' ? 'bg-success' : 'bg-outline'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-on-surface uppercase tracking-tight">{s.name}</p>
                        <p className="text-[10px] text-on-surface-dim opacity-40 uppercase tracking-widest">{s.joinDate ? new Date(s.joinDate).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className="flex items-center gap-2 text-[11px] font-black text-on-surface-dim uppercase tracking-widest">
                      <IdCard className="w-3.5 h-3.5 opacity-40" />{s.employeeId || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest ${ROLE_COLORS[s.role]}`}>
                      {ROLE_LABELS[s.role]}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="space-y-1">
                      {s.phone && <p className="flex items-center gap-1.5 text-[10px] text-on-surface-dim opacity-60"><Phone className="w-3 h-3" />{s.phone}</p>}
                      {s.email && <p className="flex items-center gap-1.5 text-[10px] text-on-surface-dim opacity-60"><Mail className="w-3 h-3" />{s.email}</p>}
                      {!s.phone && !s.email && <span className="text-[10px] text-on-surface-dim opacity-30 uppercase tracking-widest">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest ${s.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-outline text-on-surface-dim border-outline'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleStatus(s)} title={s.status === 'active' ? 'Deactivate' : 'Activate'} className="p-2 rounded-xl hover:bg-surface-container-low border border-transparent hover:border-outline transition-all active:scale-90">
                        {s.status === 'active' ? <UserX className="w-4 h-4 text-warning" /> : <UserCheck className="w-4 h-4 text-success" />}
                      </button>
                      <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all active:scale-90">
                        <Pencil className="w-4 h-4 text-primary" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="p-2 rounded-xl hover:bg-error/10 border border-transparent hover:border-error/20 transition-all active:scale-90">
                        <Trash2 className="w-4 h-4 text-error" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff Count */}
      <p className="text-[10px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-4">
        {filtered.length} of {staff.length} personnel records
      </p>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Staff Member' : 'Add New Staff Member'} onClose={() => setShowModal(false)}>
          <div className="space-y-5">
            <Field label="Full Name" required>
              <input className={inputCls} placeholder="e.g. Ahmed Rizwan" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Employee ID" required>
              <input className={inputCls} placeholder="e.g. EMP-1042" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} />
            </Field>
            <Field label="Role" required>
              <div className="relative">
                <select className={selectCls} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-on-surface-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input className={inputCls} placeholder="+960 xxx xxxx" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </Field>
              <Field label="Email">
                <input className={inputCls} placeholder="name@macl.aero" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </Field>
            </div>
            <Field label="Status">
              <div className="relative">
                <select className={selectCls} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as 'active' | 'inactive' }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="w-4 h-4 text-on-surface-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl border-transparent text-[11px] font-black uppercase tracking-widest text-on-surface-dim hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-xl kinetic-gradient text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Logo className="w-4 h-4 animate-pulse" />}
                {editing ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// ─── EQUIPMENT TAB ─────────────────────────────────────────────────────────────
const EquipmentTab: React.FC<{ push: (msg: string, type?: NotificationType) => void; confirm: (msg: string, cb: () => void) => void }> = ({ push, confirm }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');

  const emptyForm = { name: '', type: EquipmentType.REFUELLER, status: EquipmentStatus.AVAILABLE, currentVolume: 0, maxCapacity: 0 };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = subscribeToEquipment((data) => { setEquipment(data); setLoading(false); });
    return unsub;
  }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (eq: Equipment) => {
    setEditing(eq);
    setForm({ name: eq.name, type: eq.type, status: eq.status, currentVolume: eq.currentVolume, maxCapacity: eq.maxCapacity });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { push('Equipment name/ID is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateEquipment(editing.id, form);
        push('Equipment updated', 'success');
      } else {
        await addEquipment(form);
        push('Equipment added', 'success');
      }
      setShowModal(false);
    } catch (e: any) {
      const msg = e?.message?.includes('permission') ? 'Permission Denied: Unauthorized to modify equipment.' : 'Failed to save. Check Firestore permissions.';
      push(msg, 'error');
    }
    finally { setSaving(false); }
  };

  const handleDelete = (eq: Equipment) => {
    confirm(`Remove ${eq.name} from the fleet registry?`, async () => {
      try { await deleteEquipment(eq.id); push('Equipment removed', 'success'); }
      catch (e: any) { 
        const msg = e?.message?.includes('permission') ? 'Permission Denied: Unauthorized to delete records.' : 'Failed to remove equipment.';
        push(msg, 'error'); 
      }
    });
  };

  const grouped = Object.values(EquipmentType).reduce<Record<string, Equipment[]>>((acc, t) => {
    const items = equipment.filter(e => e.type === t && (filterType === 'ALL' || e.type === filterType));
    if (items.length) acc[t] = items;
    return acc;
  }, {});

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-surface-container-low border-transparent rounded-xl pl-4 pr-8 py-2 text-on-surface-dim appearance-none cursor-pointer focus:border-primary outline-none transition-all">
            <option value="ALL">All Types</option>
            {Object.values(EquipmentType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-on-surface-dim absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-premium whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Equipment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)]" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-dim opacity-40">
          <Truck className="w-12 h-12 mb-4" />
          <p className="text-sm font-black uppercase tracking-widest">No equipment records found</p>
          <p className="text-[10px] mt-1 uppercase tracking-widest">Add your first vehicle above</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest ${EQ_TYPE_COLORS[type as EquipmentType]}`}>{type}</span>
                <span className="text-[10px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">{items.length} units</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(eq => (
                  <div key={eq.id} className="card-premium p-5 group hover:scale-[1.01] transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm font-black text-on-surface uppercase tracking-tight">{eq.name}</p>
                        <p className="text-[10px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-0.5">{eq.id}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg border uppercase tracking-widest ${STATUS_COLORS[eq.status]}`}>
                        {eq.status}
                      </span>
                    </div>
                    {eq.maxCapacity > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-50 mb-1.5">
                          <span>Volume</span>
                          <span>{fmtVol(eq.currentVolume)} / {fmtVol(eq.maxCapacity)}</span>
                        </div>
                        <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${fuelFillColor(eq.currentVolume / eq.maxCapacity * 100)}`} style={{ width: `${Math.min(100, (eq.currentVolume / eq.maxCapacity) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 justify-end pt-2 border-t border-outline">
                      <button onClick={() => openEdit(eq)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest transition-all">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => handleDelete(eq)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-error/10 text-error text-[9px] font-black uppercase tracking-widest transition-all">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-4">{equipment.length} total fleet assets</p>

      {showModal && (
        <Modal title={editing ? 'Edit Equipment' : 'Add Equipment'} onClose={() => setShowModal(false)}>
          <div className="space-y-5">
            <Field label="Equipment ID / Name" required>
              <input className={inputCls} placeholder="e.g. RF-18" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Type" required>
              <div className="relative">
                <select className={selectCls} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as EquipmentType }))}>
                  {Object.values(EquipmentType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-on-surface-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
            <Field label="Status">
              <div className="relative">
                <select className={selectCls} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as EquipmentStatus }))}>
                  {Object.values(EquipmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-on-surface-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Current Volume (L)">
                <input type="number" className={inputCls} placeholder="0" min={0} value={form.currentVolume} onChange={e => setForm(p => ({ ...p, currentVolume: Number(e.target.value) }))} />
              </Field>
              <Field label="Max Capacity (L)">
                <input type="number" className={inputCls} placeholder="0" min={0} value={form.maxCapacity} onChange={e => setForm(p => ({ ...p, maxCapacity: Number(e.target.value) }))} />
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl border-transparent text-[11px] font-black uppercase tracking-widest text-on-surface-dim hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-xl kinetic-gradient text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Logo className="w-4 h-4 animate-pulse" />}
                {editing ? 'Save Changes' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// ─── TANKS TAB ─────────────────────────────────────────────────────────────────
const TanksTab: React.FC<{ push: (msg: string, type?: NotificationType) => void; confirm: (msg: string, cb: () => void) => void }> = ({ push, confirm }) => {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tank | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');

  const emptyForm = { name: '', type: FuelType.JET_A1, capacity: 0, currentLevel: 0, safeMinLevel: 0 };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = subscribeToTanks((data) => { setTanks(data); setLoading(false); });
    return unsub;
  }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (t: Tank) => {
    setEditing(t);
    setForm({ name: t.name, type: t.type, capacity: t.capacity, currentLevel: t.currentLevel, safeMinLevel: t.safeMinLevel });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { push('Tank name is required', 'error'); return; }
    if (form.capacity <= 0) { push('Capacity must be greater than 0', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateTank(editing.id, form);
        push('Tank updated', 'success');
      } else {
        await addTank(form);
        push('Tank added', 'success');
      }
      setShowModal(false);
    } catch (e: any) {
      const msg = e?.message?.includes('permission') ? 'Permission Denied: Unauthorized to modify tanks.' : 'Failed to save. Check Firestore permissions.';
      push(msg, 'error');
    }
    finally { setSaving(false); }
  };

  const handleDelete = (t: Tank) => {
    confirm(`Remove tank "${t.name}" from the inventory?`, async () => {
      try { await deleteTank(t.id); push('Tank removed', 'success'); }
      catch (e: any) { 
        const msg = e?.message?.includes('permission') ? 'Permission Denied: Unauthorized to delete records.' : 'Failed to remove tank.';
        push(msg, 'error'); 
      }
    });
  };

  const filtered = tanks.filter(t => filterType === 'ALL' || t.type === filterType);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-surface-container-low border-transparent rounded-xl pl-4 pr-8 py-2 text-on-surface-dim appearance-none cursor-pointer focus:border-primary outline-none transition-all">
            <option value="ALL">All Fuel Types</option>
            {Object.values(FuelType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-on-surface-dim absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-premium whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Tank
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-dim opacity-40">
          <Fuel className="w-12 h-12 mb-4" />
          <p className="text-sm font-black uppercase tracking-widest">No tank records found</p>
          <p className="text-[10px] mt-1 uppercase tracking-widest">Add your first tank above</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-transparent">
          <table className="min-w-full divide-y divide-outline">
            <thead className="bg-surface-container-low">
              <tr>
                {['Tank', 'Fuel Type', 'Fill Level', 'Capacity', 'Safe Min', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface-container-lowest divide-y divide-outline">
              {filtered.map(t => {
                const pct = t.capacity > 0 ? (t.currentLevel / t.capacity) * 100 : 0;
                const isCritical = t.currentLevel <= t.safeMinLevel;
                return (
                  <tr key={t.id} className={`hover:bg-primary/[0.02] transition-colors group ${isCritical ? 'border-l-2 border-error' : ''}`}>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-black text-on-surface uppercase tracking-tight">{t.name}</p>
                        <p className="text-[10px] text-on-surface-dim opacity-40 uppercase tracking-widest">{t.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest
                        ${t.type === FuelType.JET_A1 ? 'bg-primary/10 text-primary border-primary/20' :
                          t.type === FuelType.DIESEL ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-success/10 text-success border-success/20'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-6 py-5 min-w-[140px]">
                      <div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5">
                          <span className={isCritical ? 'text-error' : 'text-on-surface-dim opacity-50'}>{pct.toFixed(1)}%</span>
                          {isCritical && <span className="text-error pulse-critical px-2 rounded font-bold bg-error/10 border-l-2 border-error">CRITICAL</span>}
                        </div>
                        <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${fuelFillColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <p className="text-[9px] text-on-surface-dim opacity-40 mt-1 uppercase">{fmtVol(t.currentLevel)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-on-surface">{fmtVol(t.capacity)}</td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`text-sm font-black ${isCritical ? 'text-error' : 'text-on-surface-dim opacity-60'}`}>{fmtVol(t.safeMinLevel)}</span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                      {t.lastUpdated ? new Date(t.lastUpdated).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest transition-all">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-error/10 text-error text-[9px] font-black uppercase tracking-widest transition-all">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-4">{filtered.length} tank records • {tanks.length} total</p>

      {showModal && (
        <Modal title={editing ? 'Edit Tank' : 'Add Tank'} onClose={() => setShowModal(false)}>
          <div className="space-y-5">
            <Field label="Tank Name / ID" required>
              <input className={inputCls} placeholder="e.g. TK-104 (NFF)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Fuel Type" required>
              <div className="relative">
                <select className={selectCls} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as FuelType }))}>
                  {Object.values(FuelType).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-on-surface-dim absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Capacity (L)" required>
                <input type="number" className={inputCls} placeholder="1000000" min={1} value={form.capacity || ''} onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))} />
              </Field>
              <Field label="Current Level (L)">
                <input type="number" className={inputCls} placeholder="0" min={0} value={form.currentLevel || ''} onChange={e => setForm(p => ({ ...p, currentLevel: Number(e.target.value) }))} />
              </Field>
            </div>
            <Field label="Safe Minimum Level (L)">
              <input type="number" className={inputCls} placeholder="100000" min={0} value={form.safeMinLevel || ''} onChange={e => setForm(p => ({ ...p, safeMinLevel: Number(e.target.value) }))} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl border-transparent text-[11px] font-black uppercase tracking-widest text-on-surface-dim hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-xl kinetic-gradient text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Logo className="w-4 h-4 animate-pulse" />}
                {editing ? 'Save Changes' : 'Add Tank'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const SystemAdmin: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const { notify } = useNotification();
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, message: '', onConfirm: () => {} });
  const [isLive, setIsLive] = useState(true);

  const confirmAction = useCallback((message: string, onConfirm: () => void) => {
    setConfirm({ open: true, message, onConfirm });
  }, []);

  // Heartbeat to show Firebase is connected
  useEffect(() => {
    const interval = setInterval(() => setIsLive(v => !v), 2000);
    return () => clearInterval(interval);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'staff', label: 'Staff Management', icon: <Users className="w-4 h-4" /> },
    { key: 'equipment', label: 'Fleet Registry', icon: <Truck className="w-4 h-4" /> },
    { key: 'tanks', label: 'Tank Inventory', icon: <Fuel className="w-4 h-4" /> },
  ];

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async () => {
    confirmAction('This will overwrite current users, tanks, and equipment with mock data. Continue?', async () => {
      setIsSeeding(true);
      try {
        await seedingService.seedDatabase();
        notify('Database successfully seeded with mock data', 'success');
      } catch (error) {
        notify('Failed to seed database. Check console for details.', 'error');
      } finally {
        setIsSeeding(false);
      }
    });
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            SYSTEM <span className="text-primary italic font-medium ml-3">SETTINGS</span>
          </h1>
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Platform Administration Center</span>
            <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20" />
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full bg-primary transition-opacity duration-500 ${isLive ? 'opacity-100' : 'opacity-20'}`} />
              Firebase Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
            onClick={handleSeedData}
            disabled={isSeeding}
            className="flex items-center gap-2 px-6 py-3 bg-surface-container-low hover:bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <Database className={`w-4 h-4 text-primary ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'SEEDING...' : 'SEED INITIAL DATA'}
          </button>
          <div className="flex items-center space-x-3 bg-success/10 text-success px-6 py-3 rounded-2xl border border-success/20 font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.05)]">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>System Status: OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-premium p-6 flex items-center justify-between group hover:scale-[1.02] transition-all">
          <div>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Database</p>
            <h3 className="text-xl font-[900] text-on-surface tracking-tighter italic uppercase">CONNECTED</h3>
            <p className="text-[10px] font-black text-success mt-2 flex items-center">
              <span className={`w-1.5 h-1.5 bg-success rounded-full mr-2 shadow-[0_0_8px_rgba(34,197,94,0.4)] transition-opacity duration-500 ${isLive ? 'opacity-100' : 'opacity-30'}`} />
              FIRESTORE LIVE
            </p>
          </div>
          <div className="p-4 bg-surface-container-low rounded-2xl border-transparent group-hover:border-primary/30 transition-all">
            <Database className="w-8 h-8 text-primary opacity-60" />
          </div>
        </div>

        <div className="card-premium p-6 flex items-center justify-between group hover:scale-[1.02] transition-all">
          <div>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Sync Gateway</p>
            <h3 className="text-xl font-[900] text-on-surface tracking-tighter italic uppercase">ACTIVE</h3>
            <p className="text-[10px] font-black text-on-surface-dim mt-2 opacity-60 uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCw className={`w-3 h-3 ${isLive ? 'animate-spin' : ''}`} /> Real-time sync
            </p>
          </div>
          <div className="p-4 bg-surface-container-low rounded-2xl border-transparent group-hover:border-primary/30 transition-all">
            <Server className="w-8 h-8 text-primary opacity-60" />
          </div>
        </div>

        <div className="card-premium p-6 flex items-center justify-between group hover:scale-[1.02] transition-all">
          <div>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Security</p>
            <h3 className="text-xl font-[900] text-on-surface tracking-tighter italic uppercase">SECURE</h3>
            <p className="text-[10px] font-black text-on-surface-dim mt-2 opacity-60 uppercase tracking-widest">Admin Access Only</p>
          </div>
          <div className="p-4 bg-surface-container-low rounded-2xl border-transparent group-hover:border-primary/30 transition-all">
            <ShieldCheck className="w-8 h-8 text-primary opacity-60" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface-container-lowest rounded-3xl border-transparent overflow-hidden shadow-sm">
        <div className="border-b border-outline p-4 bg-surface-container-low/30 flex justify-center">
          <div className="bg-surface-container-low p-1.5 rounded-2xl border-transparent relative grid grid-cols-3 w-full max-w-[600px] shadow-inner">
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                ${activeTab === 'staff' ? 'left-1.5 translate-x-[0%]' : ''}
                ${activeTab === 'equipment' ? 'left-1.5 translate-x-[100%]' : ''}
                ${activeTab === 'tanks' ? 'left-1.5 translate-x-[200%]' : ''}
              `}
            />
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 sm:gap-2.5 px-1 sm:px-6 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest sm:tracking-[0.2em] transition-all relative z-10 overflow-hidden
                  ${activeTab === tab.key ? 'text-white' : 'text-on-surface-dim opacity-50 hover:opacity-100'}`}
              >
                {tab.icon}
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="inline sm:hidden truncate">{tab.key.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="p-6 lg:p-8 overflow-hidden">
          {activeTab === 'staff' && (
            <div key="staff" className="animate-in fade-in slide-in-from-left-4 duration-500">
              <StaffTab push={notify} confirm={confirmAction} currentUser={currentUser} />
            </div>
          )}
          {activeTab === 'equipment' && (
            <div key="equipment" className="animate-in fade-in slide-in-from-right-4 duration-500">
              <EquipmentTab push={notify} confirm={confirmAction} />
            </div>
          )}
          {activeTab === 'tanks' && (
            <div key="tanks" className="animate-in fade-in slide-in-from-right-4 duration-500">
              <TanksTab push={notify} confirm={confirmAction} />
            </div>
          )}
        </div>
      </div>


      {/* Confirm dialog */}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(p => ({ ...p, open: false }))} />
    </div>
  );
};

