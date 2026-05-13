import { db, auth } from '../firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { MOCK_USERS, TANKS, EQUIPMENT } from '../constants';

export const seedingService = {
  /**
   * Seeds the Firestore database with initial mock data.
   * This is useful for first-time setup or testing.
   */
  async seedDatabase() {
    console.log('Starting database seeding... User UID:', auth.currentUser?.uid || 'NOT AUTHENTICATED');
    const batch = writeBatch(db);

    try {
      // 1. Seed Users and Staff
      console.log('Seeding users and staff...');
      MOCK_USERS.forEach(user => {
        // Users collection (used by supabaseService)
        const userRef = doc(db, 'users', user.id);
        batch.set(userRef, {
          name: user.name,
          role: user.role,
          avatar: user.avatar
        });

        // Staff collection (used by firebaseService)
        const staffRef = doc(db, 'staff', user.id);
        batch.set(staffRef, {
          name: user.name,
          role: user.role,
          employeeId: `EMP-${user.id.toUpperCase()}`,
          status: 'active',
          joinDate: new Date().toISOString(),
          avatar: user.avatar
        });
      });

      // 2. Seed Tanks
      console.log('Seeding tanks...');
      TANKS.forEach(tank => {
        const tankRef = doc(db, 'tanks', tank.id);
        batch.set(tankRef, {
          name: tank.name,
          type: tank.type,
          capacity: tank.capacity,
          current_level: tank.currentLevel,
          safe_min_level: tank.safeMinLevel,
          last_updated: tank.lastUpdated
        });
      });

      // 3. Seed Equipment
      console.log('Seeding equipment...');
      EQUIPMENT.forEach(eq => {
        const eqRef = doc(db, 'equipment', eq.id);
        batch.set(eqRef, {
          name: eq.name,
          type: eq.type,
          status: eq.status,
          currentVolume: eq.currentVolume,
          maxCapacity: eq.maxCapacity,
          lastUpdated: eq.lastUpdated
        });
      });

      // Commit the batch
      await batch.commit();
      console.log('Database seeded successfully!');
      return true;
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }
};
