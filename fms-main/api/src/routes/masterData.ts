import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ── Airlines ─────────────────────────────────────────────────────────────────
router.get('/airlines', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('airlines').select('*').order('name');
    if (error) {
      console.warn('[API] GET /master/airlines error:', error);
      return res.status(500).json({ error: error.message });
    }
    const airlines = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      iataCode: row.iata_code || undefined,
      icaoCode: row.icao_code || undefined,
      category: row.category || 'INT',
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return res.json({ airlines });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/airlines', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, iataCode, icaoCode, category = 'INT', isActive = true } = req.body;
    if (!name) return res.status(400).json({ error: 'Airline name is required' });

    const cleanName = String(name).trim();
    const row = {
      name: cleanName,
      iata_code: iataCode ? String(iataCode).toUpperCase().trim() : null,
      icao_code: icaoCode ? String(icaoCode).toUpperCase().trim() : null,
      category,
      is_active: isActive
    };

    const { data, error } = await supabase.from('airlines').insert([row]).select().maybeSingle();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({
      airline: {
        id: data.id,
        name: data.name,
        iataCode: data.iata_code || undefined,
        icaoCode: data.icao_code || undefined,
        category: data.category,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/airlines/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('name' in updates && updates.name) row.name = updates.name.trim();
    if ('iataCode' in updates) row.iata_code = updates.iataCode ? String(updates.iataCode).toUpperCase().trim() : null;
    if ('icaoCode' in updates) row.icao_code = updates.icaoCode ? String(updates.icaoCode).toUpperCase().trim() : null;
    if ('category' in updates) row.category = updates.category;
    if ('isActive' in updates) row.is_active = updates.isActive;

    const { data, error } = await supabase.from('airlines').update(row).eq('id', id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, airline: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.delete('/airlines/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('airlines').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Flight Master ────────────────────────────────────────────────────────────
router.get('/flights', requireAuth, async (req: Request, res: Response) => {
  try {
    const { airlineId } = req.query;
    let query = supabase.from('flight_master').select('*').order('flight_number');
    if (airlineId) query = query.eq('airline_id', String(airlineId));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const flights = (data || []).map(row => ({
      id: row.id,
      airlineId: row.airline_id,
      airlineName: row.airline_name,
      flightNumber: row.flight_number,
      route: row.route || undefined,
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return res.json({ flights });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/flights', requireAuth, async (req: Request, res: Response) => {
  try {
    const { airlineId, airlineName, flightNumber, route, isActive = true } = req.body;
    if (!flightNumber || !airlineName) {
      return res.status(400).json({ error: 'airlineName and flightNumber are required' });
    }

    const row = {
      airline_id: airlineId || null,
      airline_name: String(airlineName).trim(),
      flight_number: String(flightNumber).toUpperCase().trim(),
      route: route ? String(route).trim() : null,
      is_active: isActive
    };

    const { data, error } = await supabase.from('flight_master').insert([row]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ flight: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/flights/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('flightNumber' in updates) row.flight_number = String(updates.flightNumber).toUpperCase().trim();
    if ('route' in updates) row.route = updates.route ? String(updates.route).trim() : null;
    if ('isActive' in updates) row.is_active = updates.isActive;

    const { data, error } = await supabase.from('flight_master').update(row).eq('id', id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, flight: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.delete('/flights/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('flight_master').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Aircraft Master ──────────────────────────────────────────────────────────
router.get('/aircraft', requireAuth, async (req: Request, res: Response) => {
  try {
    const { airlineId } = req.query;
    let query = supabase.from('aircraft_master').select('*').order('aircraft_reg');
    if (airlineId) query = query.eq('airline_id', String(airlineId));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const aircraft = (data || []).map(row => ({
      id: row.id,
      airlineId: row.airline_id,
      airlineName: row.airline_name,
      aircraftReg: row.aircraft_reg,
      aircraftType: row.aircraft_type,
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return res.json({ aircraft });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/aircraft', requireAuth, async (req: Request, res: Response) => {
  try {
    const { airlineId, airlineName, aircraftReg, aircraftType, isActive = true } = req.body;
    if (!aircraftReg || !airlineName) {
      return res.status(400).json({ error: 'airlineName and aircraftReg are required' });
    }

    const row = {
      airline_id: airlineId || null,
      airline_name: String(airlineName).trim(),
      aircraft_reg: String(aircraftReg).toUpperCase().trim(),
      aircraft_type: String(aircraftType || 'Unknown').trim(),
      is_active: isActive
    };

    const { data, error } = await supabase.from('aircraft_master').insert([row]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ aircraft: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/aircraft/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('aircraftReg' in updates) row.aircraft_reg = String(updates.aircraftReg).toUpperCase().trim();
    if ('aircraftType' in updates) row.aircraft_type = String(updates.aircraftType).trim();
    if ('isActive' in updates) row.is_active = updates.isActive;

    const { data, error } = await supabase.from('aircraft_master').update(row).eq('id', id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, aircraft: data || row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.delete('/aircraft/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('aircraft_master').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Master Hierarchy ─────────────────────────────────────────────────────────
router.get('/hierarchy', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [airlinesRes, flightsRes, aircraftRes] = await Promise.all([
      supabase.from('airlines').select('*').order('name'),
      supabase.from('flight_master').select('*').order('flight_number'),
      supabase.from('aircraft_master').select('*').order('aircraft_reg')
    ]);

    const airlines = (airlinesRes.data || []).map(r => ({
      id: r.id,
      name: r.name,
      iataCode: r.iata_code || undefined,
      icaoCode: r.icao_code || undefined,
      category: r.category || 'INT',
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const flights = (flightsRes.data || []).map(r => ({
      id: r.id,
      airlineId: r.airline_id,
      airlineName: r.airline_name,
      flightNumber: r.flight_number,
      route: r.route || undefined,
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const aircraft = (aircraftRes.data || []).map(r => ({
      id: r.id,
      airlineId: r.airline_id,
      airlineName: r.airline_name,
      aircraftReg: r.aircraft_reg,
      aircraftType: r.aircraft_type,
      isActive: r.is_active ?? true,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const hierarchy = airlines.map(airline => {
      const aFlights = flights.filter(f => f.airlineId === airline.id || f.airlineName.toLowerCase() === airline.name.toLowerCase());
      const aAircraft = aircraft.filter(a => a.airlineId === airline.id || a.airlineName.toLowerCase() === airline.name.toLowerCase());
      return {
        airline,
        flights: aFlights,
        aircrafts: aAircraft
      };
    });

    return res.json({ hierarchy });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Bulk Seed Master DB ──────────────────────────────────────────────────────
router.post('/seed', requireAuth, async (req: Request, res: Response) => {
  try {
    const { airlines = [], flights = [], aircraft = [] } = req.body;

    if (airlines.length > 0) {
      await supabase.from('airlines').upsert(airlines);
    }
    if (flights.length > 0) {
      await supabase.from('flight_master').upsert(flights);
    }
    if (aircraft.length > 0) {
      await supabase.from('aircraft_master').upsert(aircraft);
    }

    return res.json({
      success: true,
      seeded: {
        airlines: airlines.length,
        flights: flights.length,
        aircraft: aircraft.length
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
