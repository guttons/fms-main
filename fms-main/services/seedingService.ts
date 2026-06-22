import { supabase } from '../supabase';
import { MOCK_USERS, TANKS, EQUIPMENT } from '../constants';
import { supabaseService } from './supabaseService';

export const seedingService = {
  /**
   * Seeds the Supabase database with initial mock data.
   * Also clears flight_jobs and shift_briefing_info for a fresh FIDS pull.
   */
  async seedDatabase() {
    console.log('Starting Supabase database seeding...');

    try {
      // 0. Clear flight jobs and briefing data for a fresh start
      console.log('Clearing flight jobs...');
      await supabaseService.clearAllFlightJobs();
      console.log('Clearing shift briefing data...');
      await supabaseService.clearAllBriefingInfo();
      // 1. Seed Profiles (Skipped to preserve existing staff/profiles)
      /*
      console.log('Seeding profiles...');
      const profilesData = MOCK_USERS.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      }));
      const { error: profileError } = await supabase.from('profiles').upsert(profilesData);
      if (profileError) throw profileError;
      */

      // 2. Seed Staff (Skipped to preserve existing staff details)
      /*
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
      */

      // 3. Seed Tanks (Skipped to preserve existing tank levels)
      /*
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
      */

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

      // 5. Seed Finance Customers
      console.log('Seeding finance customers...');
      const finCustomersData = [
        { id: 'c1', name: 'Emirates Airlines', classification: 'ADVANCE', opening_balance: 280000, payments_received: 150000, advance_balance: 430000, credit_limit: 0, estimated_5_days_sales: 150000, running_balance: 430000, outstanding_receipts: 0, opening_balance_liters: 100000, balance_liters: 153571, associated_airlines: ['Air Arabia', 'Etihad Airways', 'Indigo'] },
        { id: 'c2', name: 'Singapore Airlines', classification: 'ADVANCE', opening_balance: 175712, payments_received: 220000, advance_balance: 395712, credit_limit: 0, estimated_5_days_sales: 80000, running_balance: 395712, outstanding_receipts: 0, opening_balance_liters: 62754, balance_liters: 141325 },
        { id: 'c3', name: 'Maldivian (IAS)', classification: 'CREDIT', opening_balance: -28200000, payments_received: 10000000, advance_balance: 0, credit_limit: 50000000, estimated_5_days_sales: 500000, running_balance: -18200000, outstanding_receipts: 18200000 },
        { id: 'c4', name: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', opening_balance: -150790, payments_received: 10000000, advance_balance: 0, credit_limit: 20000000, estimated_5_days_sales: 200000, running_balance: -150790, outstanding_receipts: 150790 },
        { id: 'c5', name: 'Flyme (Villa Air)', classification: 'CREDIT', opening_balance: 477188, payments_received: 10000000, advance_balance: 0, credit_limit: 15000000, estimated_5_days_sales: 150000, running_balance: 477188, outstanding_receipts: 0 },
        { id: 'c6', name: 'Qatar Airways', classification: 'ADVANCE', opening_balance: 151575, payments_received: 500000, advance_balance: 651575, credit_limit: 0, estimated_5_days_sales: 120000, running_balance: 651575, outstanding_receipts: 0, opening_balance_liters: 54134, balance_liters: 232705 },
        { id: 'c7', name: 'Access Flight Support', classification: 'ADVANCE', opening_balance: 26485, payments_received: 15000, advance_balance: 41485, credit_limit: 0, estimated_5_days_sales: 30000, running_balance: 41485, outstanding_receipts: 0 },
        { id: 'c8', name: 'AML Global Ltd', classification: 'ADVANCE', opening_balance: 311853, payments_received: 0, advance_balance: 311853, credit_limit: 0, estimated_5_days_sales: 50000, running_balance: 311853, outstanding_receipts: 0 },
        { id: 'c9', name: 'Aviation Services Management', classification: 'CREDIT', opening_balance: -326370, payments_received: 1215191, advance_balance: 0, credit_limit: 5000000, estimated_5_days_sales: 100000, running_balance: 888821, outstanding_receipts: 0 },
        { id: 'c10', name: 'Mega Airport Services (Cash Agent)', classification: 'CASH', opening_balance: 0, payments_received: 0, advance_balance: 0, credit_limit: 0, estimated_5_days_sales: 0, running_balance: 0, outstanding_receipts: 0 },
      ];
      const { error: finCustsError } = await supabase.from('fin_customers').upsert(finCustomersData);
      if (finCustsError) throw finCustsError;

      // 6. Seed Finance Upcoming Payments
      console.log('Seeding finance upcoming payments...');
      const upcomingPaymentsData = [
        { id: 'sw1', customer_id: 'c1', customer_name: 'Emirates Airlines', reference_number: 'SW-EMI-998', amount: 150000, upload_date: '2026-06-01', status: 'PENDING_REVIEW' },
        { id: 'sw2', customer_id: 'c6', customer_name: 'Qatar Airways', reference_number: 'SW-QTR-102', amount: 300000, upload_date: '2026-06-02', status: 'PENDING_REVIEW' }
      ];
      const { error: upcomingError } = await supabase.from('fin_upcoming_payments').upsert(upcomingPaymentsData);
      if (upcomingError) throw upcomingError;

      // 7. Seed Finance Invoices
      console.log('Seeding finance invoices...');
      const invoicesData = [
        { id: 'inv101', invoice_number: 'FFF/2025/2500001322', customer_id: 'c4', customer_name: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', amount: 98871.90, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remaining_amount: 98871.90 },
        { id: 'inv102', invoice_number: 'FFF/2025/2500001323', customer_id: 'c5', customer_name: 'Flyme (Villa Air)', classification: 'CREDIT', amount: 25000, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remaining_amount: 25000 }
      ];
      const { error: invoicesError } = await supabase.from('fin_invoices').upsert(invoicesData);
      if (invoicesError) throw invoicesError;

      // 8. Seed Finance Receipts
      console.log('Seeding finance receipts...');
      const receiptsData = [
        { id: 'rec201', receipt_number: 'REC-ORCL-091', customer_id: 'c3', customer_name: 'Maldivian (IAS)', amount: 1649988, date: '2026-06-01', status: 'UNAPPLIED', remaining_amount: 1649988 }
      ];
      const { error: receiptsError } = await supabase.from('fin_receipts').upsert(receiptsData);
      if (receiptsError) throw receiptsError;

      // 9. Seed Finance Proforma Register
      console.log('Seeding finance proforma register...');
      const proformaData = [
        { id: 'prof1', date: '2026-05-28', customer_id: 'c3', customer_name: 'Maldivian (IAS)', amount: 85000, period: 'May 15 - May 30', invoice_number: 'PF-2026-010' }
      ];
      const { error: proformaError } = await supabase.from('fin_proforma_register').upsert(proformaData);
      if (proformaError) throw proformaError;

      // 10. Seed Finance Fuel Requests
      console.log('Seeding finance fuel requests...');
      const fuelRequestsData = [
        { 
          id: 'fr1', 
          delivery_number: '312385', 
          customer_id: 'c1', 
          customer_name: 'Emirates Airlines', 
          date: '2026-06-01', 
          quantity_liters: 11059, 
          price_per_liter: 1.19197, 
          amount: 13182.00, 
          aircraft_reg: 'A6ANY', 
          status: 'APPROVED',
          category_sector: 'INT',
          operator: 'AIR ARABIA',
          flight_number: 'G9094',
          aircraft_type: 'A320',
          refuel_time_position: '07:30',
          refuel_time_commence: '07:45',
          refuel_time_complete: '08:20',
          memo_line: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 1054.56,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001270'
        },
        { 
          id: 'fr2', 
          delivery_number: '312396', 
          customer_id: 'c3', 
          customer_name: 'Maldivian (IAS)', 
          date: '2026-06-01', 
          quantity_liters: 7791, 
          price_per_liter: 1.19197, 
          amount: 9286.64, 
          aircraft_reg: '9MMVD', 
          status: 'APPROVED',
          category_sector: 'DOM',
          operator: 'MALAYSIAN AIRLINES',
          flight_number: 'MH486',
          aircraft_type: 'B737',
          refuel_time_position: '08:10',
          refuel_time_commence: '08:15',
          refuel_time_complete: '08:45',
          memo_line: 'JET FUEL SALES DOMESTIC',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 742.93,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001271'
        },
        { 
          id: 'fr3', 
          delivery_number: '312400', 
          customer_id: 'c1', 
          customer_name: 'Emirates Airlines', 
          date: '2026-06-01', 
          quantity_liters: 6700, 
          price_per_liter: 1.19197, 
          amount: 7986.20, 
          aircraft_reg: 'A6BMJ', 
          status: 'APPROVED',
          category_sector: 'INT',
          operator: 'ETIHAD AIRWAYS',
          flight_number: 'EY379',
          aircraft_type: 'B787',
          refuel_time_position: '09:05',
          refuel_time_commence: '09:12',
          refuel_time_complete: '09:40',
          memo_line: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 638.90,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001272'
        },
        { 
          id: 'fr4', 
          delivery_number: '312582', 
          customer_id: 'c1', 
          customer_name: 'Emirates Airlines', 
          date: '2026-06-02', 
          quantity_liters: 1354, 
          price_per_liter: 1.19197, 
          amount: 1613.93, 
          aircraft_reg: 'A6ARA', 
          status: 'APPROVED',
          category_sector: 'INT',
          operator: 'AIR ARABIA',
          flight_number: 'G9092',
          aircraft_type: 'A320',
          refuel_time_position: '10:00',
          refuel_time_commence: '10:05',
          refuel_time_complete: '10:20',
          memo_line: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 129.11,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001273'
        },
        { 
          id: 'fr5', 
          delivery_number: '312589', 
          customer_id: 'c3', 
          customer_name: 'Maldivian (IAS)', 
          date: '2026-06-02', 
          quantity_liters: 10316, 
          price_per_liter: 1.19197, 
          amount: 12296.36, 
          aircraft_reg: '9MMVG', 
          status: 'APPROVED',
          category_sector: 'DOM',
          operator: 'MALAYSIAN AIRLINES',
          flight_number: 'MH484',
          aircraft_type: 'B737',
          refuel_time_position: '11:15',
          refuel_time_commence: '11:20',
          refuel_time_complete: '12:00',
          memo_line: 'JET FUEL SALES DOMESTIC',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 983.71,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001274'
        },
        { 
          id: 'fr6', 
          delivery_number: '312591', 
          customer_id: 'c2', 
          customer_name: 'Singapore Airlines', 
          date: '2026-06-02', 
          quantity_liters: 372, 
          price_per_liter: 1.19197, 
          amount: 443.41, 
          aircraft_reg: 'VTIIO', 
          status: 'APPROVED',
          category_sector: 'INT',
          operator: 'INDIGO',
          flight_number: '6E1134',
          aircraft_type: 'A320',
          refuel_time_position: '13:00',
          refuel_time_commence: '13:10',
          refuel_time_complete: '13:25',
          memo_line: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circular_rate: 1.19197,
          discounts: 0,
          gst: 35.47,
          transaction_type: 'ISSUES',
          cogs_account: 'ISSUES',
          invoice_number: 'FFF/2025/2500001275'
        }
      ];
      const { error: fuelError } = await supabase.from('fin_fuel_requests').upsert(fuelRequestsData);
      if (fuelError) throw fuelError;

      // 11. Seed Finance Variance Logs
      console.log('Seeding finance variance logs...');
      const varianceLogsData = [
        { id: 'v1', month: 'May 2026', fuel_type: 'Jet A-1', fms_stock_liters: 4500000, oracle_stock_liters: 4496200, sales_quantity_liters: 3800000, variance_percentage: 0.10, status: 'PENDING_T1', physical_check_uploaded: false },
        { id: 'v2', month: 'May 2026', fuel_type: 'Diesel', fms_stock_liters: 152000, oracle_stock_liters: 151720, sales_quantity_liters: 120000, variance_percentage: 0.23, status: 'PENDING_T2', physical_check_uploaded: false },
        { id: 'v3', month: 'May 2026', fuel_type: 'Petrol', fms_stock_liters: 85000, oracle_stock_liters: 84680, sales_quantity_liters: 90000, variance_percentage: 0.35, status: 'PENDING_T3', physical_check_uploaded: false }
      ];
      const { error: varianceError } = await supabase.from('fin_variance_logs').upsert(varianceLogsData);
      if (varianceError) throw varianceError;

      // 12. Seed Finance Procurement PRs
      console.log('Seeding finance procurement PRs...');
      const procurementPRsData = [
        { id: 'pr1', pr_number: 'PR-2026-05', date: '2026-05-20', fuel_type: 'Jet A-1', quantity_liters: 1000000, platts_rate: 85.50, fob_value: 537700, vendor_invoice_verified: true, po_number: 'PO-30219', oracle_invoice_number: 'ORCL-VND-8871', status: 'AP_ENTERED_ORACLE' },
        { id: 'pr2', pr_number: 'PR-2026-06', date: '2026-06-01', fuel_type: 'Jet A-1', quantity_liters: 1500000, platts_rate: 88.20, fob_value: 832000, vendor_invoice_verified: false, status: 'PR_CONFIRMED' }
      ];
      const { error: prError } = await supabase.from('fin_procurement_prs').upsert(procurementPRsData);
      if (prError) throw prError;

      // 13. Seed Finance Surcharges
      console.log('Seeding finance surcharges...');
      const surchargesData = [
        { grn_number: 'GRN-1092', original_value: 537700, surcharge_amount: 18500, notes: 'Demurrage and port handling surcharges', date: '2026-05-24' }
      ];
      const { error: surchargeError } = await supabase.from('fin_surcharges').upsert(surchargesData);
      if (surchargeError) throw surchargeError;

      // 14. Seed Finance MPD Sales
      console.log('Seeding finance MPD sales...');
      const mpdSalesData = [
        { id: 'm1', delivery_no: '79195', date: '2026-05-31', customer_name: 'Maldives Transport and Contracting Co PLC', operator_name: 'INTERNAL TRANSPORT SERVICES', reg_no: 'C1123', diesel_liters: 22.00, petrol_liters: 0, rate_diesel: 17.54, rate_petrol: 20.50, amount_diesel: 385.88, amount_petrol: 0, invoice_number: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogs_account: 'OWN' },
        { id: 'm2', delivery_no: '79196', date: '2026-05-31', customer_name: 'Maldives Transport and Contracting Co PLC', operator_name: 'INTERNAL TRANSPORT SERVICES', reg_no: 'ST20', diesel_liters: 46.00, petrol_liters: 0, rate_diesel: 17.54, rate_petrol: 20.50, amount_diesel: 811.44, amount_petrol: 0, invoice_number: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogs_account: 'OWN' },
        { id: 'm3', delivery_no: '79197', date: '2026-05-31', customer_name: 'Maldives Transport and Contracting Co PLC', operator_name: 'INTERNAL TRANSPORT SERVICES', reg_no: 'ST17', diesel_liters: 45.00, petrol_liters: 0, rate_diesel: 17.54, rate_petrol: 20.50, amount_diesel: 789.30, amount_petrol: 0, invoice_number: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogs_account: 'OWN' },
        { id: 'm4', delivery_no: '79198', date: '2026-05-31', customer_name: 'Maldives Transport and Contracting Co PLC', operator_name: 'INTERNAL TRANSPORT SERVICES', reg_no: 'C9723', diesel_liters: 0, petrol_liters: 15.00, rate_diesel: 17.54, rate_petrol: 20.50, amount_diesel: 0, amount_petrol: 307.50, invoice_number: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogs_account: 'OWN' },
        { id: 'm5', delivery_no: '79199', date: '2026-05-31', customer_name: 'Island Aviation Services Limited', operator_name: 'ISLAND AVIATION', reg_no: 'C1210', diesel_liters: 0, petrol_liters: 47.00, rate_diesel: 17.54, rate_petrol: 20.50, amount_diesel: 0, amount_petrol: 963.50, invoice_number: '2500000160', classification: 'CREDIT', type: 'AIRSIDE', cogs_account: 'ISSUES' }
      ];
      const { error: mpdError } = await supabase.from('fin_mpd_sales').upsert(mpdSalesData);
      if (mpdError) throw mpdError;

      // 15. Seed Finance Customs Shipments
      console.log('Seeding finance customs shipments...');
      const customsShipmentsData = [
        { id: 'cs1', shipment_number: 'MACL-JET-2026-01', b_form_number: 'B-FORM-8871', arrival_date: '2026-05-15', quantity_liters: 1000000, fob_value: 537700, conversion_factor: '1 MT = 1,250 Liters', metric_tons: 800, duty_paid: 26885, royalty_rate_percent: 5, royalty_amount: 26885 },
        { id: 'cs2', shipment_number: 'MACL-JET-2026-02', b_form_number: 'B-FORM-9022', arrival_date: '2026-06-01', quantity_liters: 1500000, fob_value: 832000, conversion_factor: '1 MT = 1,250 Liters', metric_tons: 1200, duty_paid: 41600, royalty_rate_percent: 5, royalty_amount: 41600 }
      ];
      const { error: customsError } = await supabase.from('fin_customs_shipments').upsert(customsShipmentsData);
      if (customsError) throw customsError;

      console.log('Supabase database seeded successfully!');
      return true;
    } catch (error) {
      console.error('Error seeding Supabase database:', error);
      throw error;
    }
  }
};
