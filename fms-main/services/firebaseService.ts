import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { StaffMember, Equipment, Tank } from '../types';
import { EquipmentStatus, EquipmentType, FuelType, UserRole } from '../types';

// ─── Collection References ────────────────────────────────────────────────────
const staffCol = collection(db, 'staff');
const equipmentCol = collection(db, 'equipment');
const tanksCol = collection(db, 'tanks');

// ─── Helper ───────────────────────────────────────────────────────────────────
const toISOString = (val: unknown): string => {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return String(val);
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToStaff(
  callback: (staff: StaffMember[]) => void
): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const q = query(staffCol, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const staff = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? '',
        role: (data.role as UserRole) ?? UserRole.ITP_OPERATOR,
        employeeId: data.employeeId ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        status: (data.status as 'active' | 'inactive') ?? 'active',
        joinDate: toISOString(data.joinDate),
        avatar: data.avatar ?? `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 99)}`,
      } as StaffMember;
    });
    callback(staff);
  }, (error) => {
    console.error("Staff subscription error:", error);
  });
}

export async function addStaff(
  member: Omit<StaffMember, 'id'>
): Promise<void> {
  await addDoc(staffCol, {
    ...member,
    joinDate: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function updateStaff(
  id: string,
  updates: Partial<Omit<StaffMember, 'id'>>
): Promise<void> {
  await updateDoc(doc(staffCol, id), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(staffCol, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToEquipment(
  callback: (equipment: Equipment[]) => void
): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const q = query(equipmentCol, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const equipment = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? d.id,
        type: (data.type as EquipmentType) ?? EquipmentType.REFUELLER,
        status: (data.status as EquipmentStatus) ?? EquipmentStatus.AVAILABLE,
        currentVolume: data.currentVolume ?? 0,
        maxCapacity: data.maxCapacity ?? 0,
        lastUpdated: toISOString(data.lastUpdated),
      } as Equipment;
    });
    callback(equipment);
  }, (error) => {
    console.error("Equipment subscription error:", error);
  });
}

export async function addEquipment(
  eq: Omit<Equipment, 'id' | 'lastUpdated'>
): Promise<void> {
  await addDoc(equipmentCol, {
    ...eq,
    lastUpdated: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function updateEquipment(
  id: string,
  updates: Partial<Omit<Equipment, 'id'>>
): Promise<void> {
  await updateDoc(doc(equipmentCol, id), {
    ...updates,
    lastUpdated: serverTimestamp(),
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  await deleteDoc(doc(equipmentCol, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// TANKS
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToTanks(
  callback: (tanks: Tank[]) => void
): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const q = query(tanksCol, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const tanks = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? d.id,
        type: (data.type as FuelType) ?? FuelType.JET_A1,
        capacity: data.capacity ?? 0,
        currentLevel: data.currentLevel ?? 0,
        safeMinLevel: data.safeMinLevel ?? 0,
        lastUpdated: toISOString(data.lastUpdated),
      } as Tank;
    });
    callback(tanks);
  }, (error) => {
    console.error("Tanks subscription error:", error);
  });
}

export async function addTank(
  tank: Omit<Tank, 'id' | 'lastUpdated'>
): Promise<void> {
  await addDoc(tanksCol, {
    ...tank,
    lastUpdated: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function updateTank(
  id: string,
  updates: Partial<Omit<Tank, 'id'>>
): Promise<void> {
  await updateDoc(doc(tanksCol, id), {
    ...updates,
    lastUpdated: serverTimestamp(),
  });
}

export async function deleteTank(id: string): Promise<void> {
  await deleteDoc(doc(tanksCol, id));
}
