-- ============================================================================
-- Ticket Numbering Sequences Migration
-- Supports Jet A-1, MGO (Diesel & Petrol), and Offline Paper Ticket Entry
-- Default state: is_auto_enabled = FALSE (manual input mode active)
-- Only System Administrators can configure and toggle auto-numbering
-- ============================================================================

-- 1. Create table for ticket numbering sequences
CREATE TABLE IF NOT EXISTS public.ticket_sequences (
    category TEXT PRIMARY KEY, -- 'JET_A1', 'MGO', 'PAPER_OFFLINE'
    is_auto_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    prefix TEXT NOT NULL DEFAULT 'MLE-',
    format_pattern TEXT NOT NULL, -- e.g. '{PREFIX}{NUMBER}', '{PREFIX}D-{NUMBER}', '{PREFIX}P-{NUMBER}'
    padding_length INTEGER NOT NULL DEFAULT 6,
    current_number BIGINT NOT NULL DEFAULT 100000,
    min_number BIGINT NOT NULL DEFAULT 1,
    max_number BIGINT NOT NULL DEFAULT 999999,
    description TEXT,
    last_generated_ticket TEXT,
    last_generated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 2. Seed initial sequence configs (All DISABLED by default)
INSERT INTO public.ticket_sequences (
    category, 
    is_auto_enabled, 
    prefix, 
    format_pattern, 
    padding_length, 
    current_number, 
    min_number, 
    max_number, 
    description
)
VALUES 
  (
    'JET_A1', 
    FALSE, 
    'MLE-', 
    '{PREFIX}{NUMBER}', 
    6, 
    100000, 
    1, 
    999999, 
    'Jet A-1 Operations (Into-Plane Flights, Seaplane bulk, Marine Loading)'
  ),
  (
    'MGO', 
    FALSE, 
    'MLE-', 
    '{PREFIX}D-{NUMBER}', 
    6, 
    500000, 
    1, 
    999999, 
    'MGO, Diesel & Petrol Ground Station Invoices (LFS / AFS)'
  ),
  (
    'PAPER_OFFLINE', 
    FALSE, 
    'MLE-', 
    '{PREFIX}P-{NUMBER}', 
    6, 
    100000, 
    1, 
    999999, 
    'Offline Paper Ticket Entry Automated Tracking Sequence'
  )
ON CONFLICT (category) DO UPDATE SET
  description = EXCLUDED.description;

-- 3. Enable RLS
ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to ticket_sequences" ON public.ticket_sequences;
CREATE POLICY "Allow read access to ticket_sequences"
    ON public.ticket_sequences FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow write access to ticket_sequences" ON public.ticket_sequences;
CREATE POLICY "Allow write access to ticket_sequences"
    ON public.ticket_sequences FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Atomic Ticket Generator Function
CREATE OR REPLACE FUNCTION public.generate_next_ticket_number(
    p_category TEXT,
    p_operator_id TEXT DEFAULT 'System Admin',
    p_force_auto BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seq RECORD;
    v_next_num BIGINT;
    v_formatted_num TEXT;
    v_ticket TEXT;
BEGIN
    -- Row-level lock to prevent concurrent collisions
    SELECT * INTO v_seq
    FROM public.ticket_sequences
    WHERE category = p_category
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket sequence category % not found', p_category;
    END IF;

    -- If auto-generation is disabled and not forced, return disabled status
    IF NOT v_seq.is_auto_enabled AND NOT p_force_auto THEN
        RETURN jsonb_build_object(
            'success', false,
            'is_auto_enabled', false,
            'message', 'Auto-generation is disabled for ' || p_category || '. Manual entry required.'
        );
    END IF;

    -- Increment and format
    v_next_num := v_seq.current_number + 1;
    v_formatted_num := LPAD(v_next_num::TEXT, v_seq.padding_length, '0');
    
    -- Format according to template
    v_ticket := REPLACE(
        REPLACE(v_seq.format_pattern, '{PREFIX}', v_seq.prefix),
        '{NUMBER}', v_formatted_num
    );

    -- Persist state
    UPDATE public.ticket_sequences
    SET current_number = v_next_num,
        last_generated_ticket = v_ticket,
        last_generated_at = NOW(),
        updated_at = NOW(),
        updated_by = p_operator_id
    WHERE category = p_category;

    RETURN jsonb_build_object(
        'success', true,
        'is_auto_enabled', v_seq.is_auto_enabled,
        'ticket_number', v_ticket,
        'sequence_number', v_next_num,
        'category', p_category
    );
END;
$$;
