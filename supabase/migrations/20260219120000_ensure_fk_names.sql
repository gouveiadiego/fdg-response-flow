-- Enforce specific names for Foreign Key constraints to ensure PostgREST relationship detection works consistently

ALTER TABLE public.ticket_support_agents 
  DROP CONSTRAINT IF EXISTS ticket_support_agents_ticket_id_fkey;

ALTER TABLE public.ticket_support_agents
  ADD CONSTRAINT ticket_support_agents_ticket_id_fkey 
  FOREIGN KEY (ticket_id) 
  REFERENCES public.tickets(id) 
  ON DELETE CASCADE;

ALTER TABLE public.ticket_support_agents 
  DROP CONSTRAINT IF EXISTS ticket_support_agents_agent_id_fkey;

ALTER TABLE public.ticket_support_agents
  ADD CONSTRAINT ticket_support_agents_agent_id_fkey 
  FOREIGN KEY (agent_id) 
  REFERENCES public.agents(id);
