import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_customers').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const customers = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      classification: row.classification,
      openingBalance: Number(row.opening_balance) || 0,
      paymentsReceived: Number(row.payments_received) || 0,
      advanceBalance: Number(row.advance_balance) || 0,
      creditLimit: Number(row.credit_limit) || 0,
      estimated5DaysSales: Number(row.estimated_5_days_sales) || 0,
      runningBalance: Number(row.running_balance) || 0,
      outstandingReceipts: Number(row.outstanding_receipts) || 0,
      openingBalanceLiters: row.opening_balance_liters ? Number(row.opening_balance_liters) : undefined,
      balanceLiters: row.balance_liters ? Number(row.balance_liters) : undefined,
      associatedAirlines: row.associated_airlines || []
    }));
    return res.json({ customers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/customers/upsert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'customers array is required' });
    }
    const rows = customers.map(c => ({
      id: c.id,
      name: c.name,
      classification: c.classification,
      opening_balance: c.openingBalance,
      payments_received: c.paymentsReceived,
      advance_balance: c.advanceBalance,
      credit_limit: c.creditLimit,
      estimated_5_days_sales: c.estimated5DaysSales,
      running_balance: c.runningBalance,
      outstanding_receipts: c.outstandingReceipts,
      opening_balance_liters: c.openingBalanceLiters ?? null,
      balance_liters: c.balanceLiters ?? null,
      associated_airlines: c.associatedAirlines || null
    }));
    const { error } = await supabase.from('fin_customers').upsert(rows);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Upcoming Payments ────────────────────────────────────────────────────────
router.get('/upcoming-payments', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_upcoming_payments').select('*').order('upload_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const payments = (data || []).map(row => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      referenceNumber: row.reference_number,
      amount: Number(row.amount),
      uploadDate: row.upload_date,
      status: row.status,
      swiftCopyUrl: row.swift_copy_url
    }));
    return res.json({ payments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/upcoming-payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const payment = req.body;
    const row = {
      id: payment.id,
      customer_id: payment.customerId,
      customer_name: payment.customerName,
      reference_number: payment.referenceNumber,
      amount: payment.amount,
      upload_date: payment.uploadDate,
      status: payment.status,
      swift_copy_url: payment.swiftCopyUrl || null
    };
    const { error } = await supabase.from('fin_upcoming_payments').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, payment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/upcoming-payments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('swiftCopyUrl' in updates) row.swift_copy_url = updates.swiftCopyUrl;

    const { error } = await supabase.from('fin_upcoming_payments').update(row).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id, updates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Invoices ─────────────────────────────────────────────────────────────────
router.get('/invoices', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_invoices').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const invoices = (data || []).map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      classification: row.classification,
      amount: Number(row.amount),
      period: row.period,
      date: row.date,
      status: row.status,
      remainingAmount: Number(row.remaining_amount)
    }));
    return res.json({ invoices });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/invoices', requireAuth, async (req: Request, res: Response) => {
  try {
    const invoice = req.body;
    const row = {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      customer_id: invoice.customerId,
      customer_name: invoice.customerName,
      classification: invoice.classification,
      amount: invoice.amount,
      period: invoice.period,
      date: invoice.date,
      status: invoice.status,
      remaining_amount: invoice.remainingAmount
    };
    const { error } = await supabase.from('fin_invoices').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, invoice });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/invoices/upsert-bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { invoices } = req.body;
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ error: 'invoices array is required' });
    }
    const rows = invoices.map(i => ({
      id: i.id,
      invoice_number: i.invoiceNumber,
      customer_id: i.customerId,
      customer_name: i.customerName,
      classification: i.classification,
      amount: i.amount,
      period: i.period,
      date: i.date,
      status: i.status,
      remaining_amount: i.remainingAmount
    }));
    const { error } = await supabase.from('fin_invoices').upsert(rows);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Receipts ─────────────────────────────────────────────────────────────────
router.get('/receipts', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_receipts').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const receipts = (data || []).map(row => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: Number(row.amount),
      date: row.date,
      status: row.status,
      remainingAmount: Number(row.remaining_amount)
    }));
    return res.json({ receipts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/receipts', requireAuth, async (req: Request, res: Response) => {
  try {
    const receipt = req.body;
    const row = {
      id: receipt.id,
      receipt_number: receipt.receiptNumber,
      customer_id: receipt.customerId,
      customer_name: receipt.customerName,
      amount: receipt.amount,
      date: receipt.date,
      status: receipt.status,
      remaining_amount: receipt.remainingAmount
    };
    const { error } = await supabase.from('fin_receipts').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, receipt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/receipts/upsert-bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { receipts } = req.body;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts array is required' });
    }
    const rows = receipts.map(r => ({
      id: r.id,
      receipt_number: r.receiptNumber,
      customer_id: r.customerId,
      customer_name: r.customerName,
      amount: r.amount,
      date: r.date,
      status: r.status,
      remaining_amount: r.remainingAmount
    }));
    const { error } = await supabase.from('fin_receipts').upsert(rows);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Proforma ─────────────────────────────────────────────────────────────────
router.get('/proforma', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_proforma_register').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const records = (data || []).map(row => ({
      id: row.id,
      date: row.date,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: Number(row.amount),
      period: row.period,
      invoiceNumber: row.invoice_number
    }));
    return res.json({ records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/proforma', requireAuth, async (req: Request, res: Response) => {
  try {
    const record = req.body;
    const row = {
      id: record.id,
      date: record.date,
      customer_id: record.customerId,
      customer_name: record.customerName,
      amount: record.amount,
      period: record.period,
      invoice_number: record.invoiceNumber
    };
    const { error } = await supabase.from('fin_proforma_register').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Fuel Requests ────────────────────────────────────────────────────────────
router.get('/fuel-requests', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_fuel_requests').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const requests = (data || []).map(row => ({
      id: row.id,
      deliveryNumber: row.delivery_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: row.date,
      quantityLiters: Number(row.quantity_liters),
      pricePerLiter: Number(row.price_per_liter),
      amount: Number(row.amount),
      aircraftReg: row.aircraft_reg,
      status: row.status,
      categorySector: row.category_sector,
      operator: row.operator,
      flightNumber: row.flight_number,
      aircraftType: row.aircraft_type,
      refuelTimePosition: row.refuel_time_position,
      refuelTimeCommence: row.refuel_time_commence,
      refuelTimeComplete: row.refuel_time_complete,
      memoLine: row.memo_line,
      currency: row.currency,
      circularRate: Number(row.circular_rate),
      discounts: Number(row.discounts),
      gst: Number(row.gst),
      transactionType: row.transaction_type,
      cogsAccount: row.cogs_account,
      invoiceNumber: row.invoice_number
    }));
    return res.json({ requests });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/fuel-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const request = req.body;
    const row = {
      id: request.id,
      delivery_number: request.deliveryNumber,
      customer_id: request.customerId,
      customer_name: request.customerName,
      date: request.date,
      quantity_liters: request.quantityLiters,
      price_per_liter: request.pricePerLiter,
      amount: request.amount,
      aircraft_reg: request.aircraftReg,
      status: request.status,
      category_sector: request.categorySector,
      operator: request.operator,
      flight_number: request.flightNumber,
      aircraft_type: request.aircraftType,
      refuel_time_position: request.refuelTimePosition,
      refuel_time_commence: request.refuelTimeCommence,
      refuel_time_complete: request.refuelTimeComplete,
      memo_line: request.memoLine,
      currency: request.currency,
      circular_rate: request.circularRate,
      discounts: request.discounts,
      gst: request.gst,
      transaction_type: request.transactionType,
      cogs_account: request.cogsAccount,
      invoice_number: request.invoiceNumber || null
    };
    const { error } = await supabase.from('fin_fuel_requests').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, request });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/fuel-requests/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('invoiceNumber' in updates) row.invoice_number = updates.invoiceNumber;

    const { error } = await supabase.from('fin_fuel_requests').update(row).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id, updates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Month End Variances ──────────────────────────────────────────────────────
router.get('/variances', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_variance_logs').select('*').order('month', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const logs = (data || []).map(row => ({
      id: row.id,
      month: row.month,
      fuelType: row.fuel_type,
      fmsStockLiters: Number(row.fms_stock_liters),
      oracleStockLiters: Number(row.oracle_stock_liters),
      salesQuantityLiters: Number(row.sales_quantity_liters),
      variancePercentage: Number(row.variance_percentage),
      status: row.status,
      physicalCheckUploaded: row.physical_check_uploaded,
      notes: row.notes
    }));
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/variances', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = req.body;
    const row = {
      id: log.id,
      month: log.month,
      fuel_type: log.fuelType,
      fms_stock_liters: log.fmsStockLiters,
      oracle_stock_liters: log.oracleStockLiters,
      sales_quantity_liters: log.salesQuantityLiters,
      variance_percentage: log.variancePercentage,
      status: log.status,
      physical_check_uploaded: log.physicalCheckUploaded,
      notes: log.notes || null
    };
    const { error } = await supabase.from('fin_variance_logs').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, log });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/variances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('physicalCheckUploaded' in updates) row.physical_check_uploaded = updates.physicalCheckUploaded;
    if ('notes' in updates) row.notes = updates.notes;

    const { error } = await supabase.from('fin_variance_logs').update(row).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id, updates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Procurement PRs ──────────────────────────────────────────────────────────
router.get('/procurement', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_procurement_prs').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const prs = (data || []).map(row => ({
      id: row.id,
      prNumber: row.pr_number,
      date: row.date,
      fuelType: row.fuel_type,
      quantityLiters: Number(row.quantity_liters),
      plattsRate: Number(row.platts_rate),
      fobValue: Number(row.fob_value),
      vendorInvoiceVerified: row.vendor_invoice_verified,
      poNumber: row.po_number,
      oracleInvoiceNumber: row.oracle_invoice_number,
      status: row.status
    }));
    return res.json({ prs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/procurement', requireAuth, async (req: Request, res: Response) => {
  try {
    const pr = req.body;
    const row = {
      id: pr.id,
      pr_number: pr.prNumber,
      date: pr.date,
      fuel_type: pr.fuelType,
      quantity_liters: pr.quantityLiters,
      platts_rate: pr.plattsRate,
      fob_value: pr.fobValue,
      vendor_invoice_verified: pr.vendorInvoiceVerified,
      po_number: pr.poNumber || null,
      oracle_invoice_number: pr.oracleInvoiceNumber || null,
      status: pr.status
    };
    const { error } = await supabase.from('fin_procurement_prs').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, pr });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.patch('/procurement/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('vendorInvoiceVerified' in updates) row.vendor_invoice_verified = updates.vendorInvoiceVerified;
    if ('poNumber' in updates) row.po_number = updates.poNumber;
    if ('oracleInvoiceNumber' in updates) row.oracle_invoice_number = updates.oracleInvoiceNumber;

    const { error } = await supabase.from('fin_procurement_prs').update(row).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, id, updates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Surcharges ───────────────────────────────────────────────────────────────
router.get('/surcharges', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_surcharges').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const surcharges = (data || []).map(row => ({
      grnNumber: row.grn_number,
      originalValue: Number(row.original_value),
      surchargeAmount: Number(row.surcharge_amount),
      notes: row.notes,
      date: row.date
    }));
    return res.json({ surcharges });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/surcharges', requireAuth, async (req: Request, res: Response) => {
  try {
    const surcharge = req.body;
    const row = {
      grn_number: surcharge.grnNumber,
      original_value: surcharge.originalValue,
      surcharge_amount: surcharge.surchargeAmount,
      notes: surcharge.notes,
      date: surcharge.date
    };
    const { error } = await supabase.from('fin_surcharges').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, surcharge });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── MPD Sales ────────────────────────────────────────────────────────────────
router.get('/mpd-sales', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_mpd_sales').select('*').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const sales = (data || []).map(row => ({
      id: row.id,
      deliveryNo: row.delivery_no,
      date: row.date,
      customerName: row.customer_name,
      operatorName: row.operator_name,
      regNo: row.reg_no,
      dieselLiters: Number(row.diesel_liters),
      petrolLiters: Number(row.petrol_liters),
      rateDiesel: Number(row.rate_diesel),
      ratePetrol: Number(row.rate_petrol),
      amountDiesel: Number(row.amount_diesel),
      amountPetrol: Number(row.amount_petrol),
      invoiceNumber: row.invoice_number,
      classification: row.classification,
      type: row.type,
      cogsAccount: row.cogs_account
    }));
    return res.json({ sales });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/mpd-sales', requireAuth, async (req: Request, res: Response) => {
  try {
    const sale = req.body;
    const row = {
      id: sale.id,
      delivery_no: sale.deliveryNo,
      date: sale.date,
      customer_name: sale.customerName,
      operator_name: sale.operatorName,
      reg_no: sale.regNo,
      diesel_liters: sale.dieselLiters,
      petrol_liters: sale.petrolLiters,
      rate_diesel: sale.rateDiesel,
      rate_petrol: sale.ratePetrol,
      amount_diesel: sale.amountDiesel,
      amount_petrol: sale.amountPetrol,
      invoice_number: sale.invoiceNumber || null,
      classification: sale.classification,
      type: sale.type,
      cogs_account: sale.cogsAccount
    };
    const { error } = await supabase.from('fin_mpd_sales').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, sale });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Customs Shipments ────────────────────────────────────────────────────────
router.get('/customs', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('fin_customs_shipments').select('*').order('arrival_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const shipments = (data || []).map(row => ({
      id: row.id,
      shipmentNumber: row.shipment_number,
      bFormNumber: row.b_form_number,
      arrivalDate: row.arrival_date,
      quantityLiters: Number(row.quantity_liters),
      fobValue: Number(row.fob_value),
      conversionFactor: row.conversion_factor,
      metricTons: Number(row.metric_tons),
      dutyPaid: Number(row.duty_paid),
      royaltyRatePercent: Number(row.royalty_rate_percent),
      royaltyAmount: Number(row.royalty_amount)
    }));
    return res.json({ shipments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/customs', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipment = req.body;
    const row = {
      id: shipment.id,
      shipment_number: shipment.shipmentNumber,
      b_form_number: shipment.bFormNumber,
      arrival_date: shipment.arrivalDate,
      quantity_liters: shipment.quantityLiters,
      fob_value: shipment.fobValue,
      conversion_factor: shipment.conversionFactor,
      metric_tons: shipment.metricTons,
      duty_paid: shipment.dutyPaid,
      royalty_rate_percent: shipment.royaltyRatePercent,
      royalty_amount: shipment.royaltyAmount
    };
    const { error } = await supabase.from('fin_customs_shipments').insert([row]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, shipment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
