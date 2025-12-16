-- Adicionar campos para agentes de apoio na tabela tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS support_agent_1_id UUID REFERENCES public.agents(id),
ADD COLUMN IF NOT EXISTS support_agent_1_arrival TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_agent_1_departure TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_agent_2_id UUID REFERENCES public.agents(id),
ADD COLUMN IF NOT EXISTS support_agent_2_arrival TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_agent_2_departure TIMESTAMPTZ;