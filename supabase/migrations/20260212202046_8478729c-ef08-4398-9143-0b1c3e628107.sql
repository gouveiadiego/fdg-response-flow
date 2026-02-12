-- Drop the auto-generate code trigger
DROP TRIGGER IF EXISTS generate_ticket_code_trigger ON public.tickets;
DROP FUNCTION IF EXISTS generate_ticket_code();

-- Make code column nullable and default to null
ALTER TABLE public.tickets ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN code SET DEFAULT NULL;