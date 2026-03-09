-- Standardize payment fields for support agents to match main agent

ALTER TABLE public.ticket_support_agents 
  RENAME COLUMN is_paid TO payment_status_old;

ALTER TABLE public.ticket_support_agents
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- Migrate data if any exists
UPDATE public.ticket_support_agents 
SET payment_status = CASE WHEN payment_status_old = true THEN 'pago' ELSE 'pendente' END;

-- Optional: Drop old column if you are sure
-- ALTER TABLE public.ticket_support_agents DROP COLUMN payment_status_old;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
