-- Create ticket_support_agents table
CREATE TABLE public.ticket_support_agents (
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

-- Habilitar RLS
ALTER TABLE public.ticket_support_agents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para autenticados"
  ON public.ticket_support_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção para autenticados"
  ON public.ticket_support_agents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização para autenticados"
  ON public.ticket_support_agents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir deleção para autenticados"
  ON public.ticket_support_agents FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_ticket_support_agents_updated_at BEFORE UPDATE ON public.ticket_support_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from tickets table (Support Agent 1)
INSERT INTO public.ticket_support_agents (
  ticket_id, agent_id, arrival, departure, km_start, km_end, 
  toll_cost, food_cost, other_costs, payment_status, paid_at
)
SELECT 
  id, support_agent_1_id, support_agent_1_arrival::timestamp with time zone, support_agent_1_departure::timestamp with time zone, 
  support_agent_1_km_start, support_agent_1_km_end,
  support_agent_1_toll_cost, support_agent_1_food_cost, support_agent_1_other_costs,
  COALESCE(support_agent_1_payment_status, 'pendente'),
  support_agent_1_paid_at::timestamp with time zone
FROM public.tickets
WHERE support_agent_1_id IS NOT NULL;

-- Migrate existing data from tickets table (Support Agent 2)
INSERT INTO public.ticket_support_agents (
  ticket_id, agent_id, arrival, departure, km_start, km_end, 
  toll_cost, food_cost, other_costs, payment_status, paid_at
)
SELECT 
  id, support_agent_2_id, support_agent_2_arrival::timestamp with time zone, support_agent_2_departure::timestamp with time zone, 
  support_agent_2_km_start, support_agent_2_km_end,
  support_agent_2_toll_cost, support_agent_2_food_cost, support_agent_2_other_costs,
  COALESCE(support_agent_2_payment_status, 'pendente'),
  support_agent_2_paid_at::timestamp with time zone
FROM public.tickets
WHERE support_agent_2_id IS NOT NULL;

-- Drop old columns from tickets table
ALTER TABLE public.tickets
  DROP COLUMN support_agent_1_id,
  DROP COLUMN support_agent_1_arrival,
  DROP COLUMN support_agent_1_departure,
  DROP COLUMN support_agent_1_km_start,
  DROP COLUMN support_agent_1_km_end,
  DROP COLUMN support_agent_1_toll_cost,
  DROP COLUMN support_agent_1_food_cost,
  DROP COLUMN support_agent_1_other_costs,
  DROP COLUMN support_agent_1_payment_status,
  DROP COLUMN support_agent_1_paid_at,
  DROP COLUMN support_agent_2_id,
  DROP COLUMN support_agent_2_arrival,
  DROP COLUMN support_agent_2_departure,
  DROP COLUMN support_agent_2_km_start,
  DROP COLUMN support_agent_2_km_end,
  DROP COLUMN support_agent_2_toll_cost,
  DROP COLUMN support_agent_2_food_cost,
  DROP COLUMN support_agent_2_other_costs,
  DROP COLUMN support_agent_2_payment_status,
  DROP COLUMN support_agent_2_paid_at;
