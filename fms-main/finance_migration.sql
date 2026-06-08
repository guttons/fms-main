-- DATABASE MIGRATION SCRIPT FOR FINANCE MODULE
-- Run this in your Supabase Dashboard > SQL Editor > New Query

-- 1. Create fin_customers Table
CREATE TABLE IF NOT EXISTS public.fin_customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    classification TEXT NOT NULL,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    payments_received NUMERIC NOT NULL DEFAULT 0,
    advance_balance NUMERIC NOT NULL DEFAULT 0,
    credit_limit NUMERIC NOT NULL DEFAULT 0,
    estimated_5_days_sales NUMERIC NOT NULL DEFAULT 0,
    running_balance NUMERIC NOT NULL DEFAULT 0,
    outstanding_receipts NUMERIC NOT NULL DEFAULT 0,
    opening_balance_liters NUMERIC,
    balance_liters NUMERIC,
    associated_airlines TEXT[]
);
ALTER TABLE public.fin_customers DISABLE ROW LEVEL SECURITY;

-- 2. Create fin_upcoming_payments Table
CREATE TABLE IF NOT EXISTS public.fin_upcoming_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    reference_number TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    upload_date DATE NOT NULL,
    status TEXT NOT NULL,
    swift_copy_url TEXT
);
ALTER TABLE public.fin_upcoming_payments DISABLE ROW LEVEL SECURITY;

-- 3. Create fin_invoices Table
CREATE TABLE IF NOT EXISTS public.fin_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    period TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    remaining_amount NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.fin_invoices DISABLE ROW LEVEL SECURITY;

-- 4. Create fin_receipts Table
CREATE TABLE IF NOT EXISTS public.fin_receipts (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    remaining_amount NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.fin_receipts DISABLE ROW LEVEL SECURITY;

-- 5. Create fin_proforma_register Table
CREATE TABLE IF NOT EXISTS public.fin_proforma_register (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    period TEXT NOT NULL,
    invoice_number TEXT NOT NULL
);
ALTER TABLE public.fin_proforma_register DISABLE ROW LEVEL SECURITY;

-- 6. Create fin_fuel_requests Table
CREATE TABLE IF NOT EXISTS public.fin_fuel_requests (
    id TEXT PRIMARY KEY,
    delivery_number TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    date DATE NOT NULL,
    quantity_liters NUMERIC NOT NULL,
    price_per_liter NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    aircraft_reg TEXT NOT NULL,
    status TEXT NOT NULL,
    category_sector TEXT NOT NULL,
    operator TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    aircraft_type TEXT NOT NULL,
    refuel_time_position TEXT NOT NULL,
    refuel_time_commence TEXT NOT NULL,
    refuel_time_complete TEXT NOT NULL,
    memo_line TEXT NOT NULL,
    currency TEXT NOT NULL,
    circular_rate NUMERIC NOT NULL,
    discounts NUMERIC NOT NULL DEFAULT 0,
    gst NUMERIC NOT NULL DEFAULT 0,
    transaction_type TEXT NOT NULL,
    cogs_account TEXT NOT NULL,
    invoice_number TEXT
);
ALTER TABLE public.fin_fuel_requests DISABLE ROW LEVEL SECURITY;

-- 7. Create fin_variance_logs Table
CREATE TABLE IF NOT EXISTS public.fin_variance_logs (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    fuel_type TEXT NOT NULL,
    fms_stock_liters NUMERIC NOT NULL,
    oracle_stock_liters NUMERIC NOT NULL,
    sales_quantity_liters NUMERIC NOT NULL,
    variance_percentage NUMERIC NOT NULL,
    status TEXT NOT NULL,
    physical_check_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);
ALTER TABLE public.fin_variance_logs DISABLE ROW LEVEL SECURITY;

-- 8. Create fin_procurement_prs Table
CREATE TABLE IF NOT EXISTS public.fin_procurement_prs (
    id TEXT PRIMARY KEY,
    pr_number TEXT NOT NULL,
    date DATE NOT NULL,
    fuel_type TEXT NOT NULL,
    quantity_liters NUMERIC NOT NULL,
    platts_rate NUMERIC NOT NULL,
    fob_value NUMERIC NOT NULL,
    vendor_invoice_verified BOOLEAN NOT NULL DEFAULT FALSE,
    po_number TEXT,
    oracle_invoice_number TEXT,
    status TEXT NOT NULL
);
ALTER TABLE public.fin_procurement_prs DISABLE ROW LEVEL SECURITY;

-- 9. Create fin_surcharges Table
CREATE TABLE IF NOT EXISTS public.fin_surcharges (
    grn_number TEXT PRIMARY KEY,
    original_value NUMERIC NOT NULL,
    surcharge_amount NUMERIC NOT NULL,
    notes TEXT NOT NULL,
    date DATE NOT NULL
);
ALTER TABLE public.fin_surcharges DISABLE ROW LEVEL SECURITY;

-- 10. Create fin_mpd_sales Table
CREATE TABLE IF NOT EXISTS public.fin_mpd_sales (
    id TEXT PRIMARY KEY,
    delivery_no TEXT NOT NULL,
    date DATE NOT NULL,
    customer_name TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    reg_no TEXT NOT NULL,
    diesel_liters NUMERIC NOT NULL DEFAULT 0,
    petrol_liters NUMERIC NOT NULL DEFAULT 0,
    rate_diesel NUMERIC NOT NULL,
    rate_petrol NUMERIC NOT NULL,
    amount_diesel NUMERIC NOT NULL DEFAULT 0,
    amount_petrol NUMERIC NOT NULL DEFAULT 0,
    invoice_number TEXT,
    classification TEXT NOT NULL,
    type TEXT NOT NULL,
    cogs_account TEXT NOT NULL
);
ALTER TABLE public.fin_mpd_sales DISABLE ROW LEVEL SECURITY;

-- 11. Create fin_customs_shipments Table
CREATE TABLE IF NOT EXISTS public.fin_customs_shipments (
    id TEXT PRIMARY KEY,
    shipment_number TEXT NOT NULL,
    b_form_number TEXT NOT NULL,
    arrival_date DATE NOT NULL,
    quantity_liters NUMERIC NOT NULL,
    fob_value NUMERIC NOT NULL,
    conversion_factor TEXT NOT NULL,
    metric_tons NUMERIC NOT NULL,
    duty_paid NUMERIC NOT NULL,
    royalty_rate_percent NUMERIC NOT NULL,
    royalty_amount NUMERIC NOT NULL
);
ALTER TABLE public.fin_customs_shipments DISABLE ROW LEVEL SECURITY;
