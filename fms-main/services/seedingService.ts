import { supabase } from '../supabase';
import { MOCK_USERS, TANKS, EQUIPMENT } from '../constants';

export const seedingService = {
  /**
   * Seeds the Supabase database with initial mock data.
   * This is useful for first-time setup or testing.
   */
  async seedDatabase() {
    console.log('Starting Supabase database seeding...');

    try {
      // 1. Seed Profiles
      console.log('Seeding profiles...');
      const profilesData = MOCK_USERS.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      }));
      const { error: profileError } = await supabase.from('profiles').upsert(profilesData);
      if (profileError) throw profileError;

      // 2. Seed Staff
      console.log('Seeding staff...');
      const staffData = MOCK_USERS.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        employee_id: `EMP-${user.id.toUpperCase()}`,
        status: 'active',
        avatar: user.avatar
      }));
      const { error: staffError } = await supabase.from('staff').upsert(staffData);
      if (staffError) throw staffError;

      // 3. Seed Tanks
      console.log('Seeding tanks...');
      const tanksData = TANKS.map(tank => ({
        id: tank.id,
        name: tank.name,
        type: tank.type,
        capacity: tank.capacity,
        current_level: tank.currentLevel,
        safe_min_level: tank.safeMinLevel,
        last_updated: tank.lastUpdated || new Date().toISOString()
      }));
      const { error: tanksError } = await supabase.from('tanks').upsert(tanksData);
      if (tanksError) throw tanksError;

      // 4. Seed Equipment
      console.log('Seeding equipment...');
      const eqData = EQUIPMENT.map(eq => ({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        status: eq.status,
        current_volume: eq.currentVolume,
        max_capacity: eq.maxCapacity,
        last_updated: eq.lastUpdated || new Date().toISOString()
      }));
      const { error: eqError } = await supabase.from('equipment').upsert(eqData);
      if (eqError) throw eqError;

      console.log('Supabase database seeded successfully!');
      return true;
    } catch (error) {
      console.error('Error seeding Supabase database:', error);
      throw error;
    }
  }
};
