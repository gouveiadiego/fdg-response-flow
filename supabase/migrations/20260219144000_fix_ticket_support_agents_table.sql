-- Create table if it doesn't exist (in case previous migration failed)
CREATE TABLE IF NOT EXISTS public.ticket_support_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id),
  arrival TIMESTAMP WITH TIME ZONE,
  departure TIMESTAMP WITH TIME ZONE,
  km_start FLOAT8 DEFAULT 0,
  km_end FLOAT8 DEFAULT 0,
  toll_cost FLOAT8 DEFAULT 0,
  food_cost FLOAT8 DEFAULT 0,
  other_costs FLOAT8 DEFAULT 0,
  payment_status TEXT DEFAULT 'pendente',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS (idempotent)
ALTER TABLE public.ticket_support_agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON public.ticket_support_agents;
DROP POLICY IF EXISTS "Permitir inserção para autenticados" ON public.ticket_support_agents;
DROP POLICY IF EXISTS "Permitir atualização para autenticados" ON public.ticket_support_agents;
DROP POLICY IF EXISTS "Permitir deleção para autenticados" ON public.ticket_support_agents;

-- Re-create policies
CREATE POLICY "Permitir leitura para autenticados" ON public.ticket_support_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção para autenticados" ON public.ticket_support_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização para autenticados" ON public.ticket_support_agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir deleção para autenticados" ON public.ticket_support_agents FOR DELETE TO authenticated USING (true);

-- Grant permissions explicitly again to ensure visibility
GRANT ALL ON public.ticket_support_agents TO authenticated;
GRANT ALL ON public.ticket_support_agents TO service_role;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
