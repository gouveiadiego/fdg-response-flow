-- Adicionar campo CEP para agentes
ALTER TABLE public.agents
ADD COLUMN cep TEXT;