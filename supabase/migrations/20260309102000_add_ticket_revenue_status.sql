-- Add revenue status and paid_at tracking columns

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS revenue_status TEXT DEFAULT 'pendente' CHECK (revenue_status IN ('pendente', 'recebido')),
  ADD COLUMN IF NOT EXISTS revenue_paid_at TIMESTAMPTZ DEFAULT NULL;

-- Refresh PostgREST schema cache to ensure the API recognizes the new columns immediately
NOTIFY pgrst, 'reload schema';
