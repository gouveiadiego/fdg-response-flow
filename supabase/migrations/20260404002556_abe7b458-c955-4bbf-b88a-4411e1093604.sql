-- Create enum for client status
CREATE TYPE public.client_status AS ENUM ('ativo', 'inativo', 'pre_cadastro');

-- Add status column to clients table with default 'ativo' so existing clients are unaffected
ALTER TABLE public.clients ADD COLUMN status public.client_status NOT NULL DEFAULT 'ativo';