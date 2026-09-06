-- Migration: push_subscriptions and flight alerts tracking
-- Run this migration in your Supabase SQL Editor

-- 1. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_role ON public.push_subscriptions(user_role);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and anon to manage push subscriptions
CREATE POLICY "Allow all to read push subscriptions"
    ON public.push_subscriptions FOR SELECT
    USING (true);

CREATE POLICY "Allow all to insert/update push subscriptions"
    ON public.push_subscriptions FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Add alert tracking flags to flight_jobs if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'flight_jobs' 
        AND column_name = 'eta_alert_15_sent'
    ) THEN
        ALTER TABLE public.flight_jobs ADD COLUMN eta_alert_15_sent BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'flight_jobs' 
        AND column_name = 'eta_alert_5_sent'
    ) THEN
        ALTER TABLE public.flight_jobs ADD COLUMN eta_alert_5_sent BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'flight_jobs' 
        AND column_name = 'landed_alert_sent'
    ) THEN
        ALTER TABLE public.flight_jobs ADD COLUMN landed_alert_sent BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Default VAPID keys in app_settings table (can be updated with custom keys)
INSERT INTO public.app_settings (key, value)
VALUES (
    'vapid_keys',
    jsonb_build_object(
        'publicKey', 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        'privateKey', 'UUxI4sIqI3m0iU70m_93uC4p6xW2N8e1l3K_5k9l8M4',
        'subject', 'mailto:admin@macl.aero'
    )
)
ON CONFLICT (key) DO NOTHING;
