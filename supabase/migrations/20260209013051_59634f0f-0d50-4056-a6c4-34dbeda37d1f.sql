-- Adicionar campos bancários e PIX para agentes
ALTER TABLE public.agents
ADD COLUMN pix_key TEXT,
ADD COLUMN bank_name TEXT,
ADD COLUMN bank_agency TEXT,
ADD COLUMN bank_account TEXT,
ADD COLUMN bank_account_type TEXT;