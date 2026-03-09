-- Add compensation/fee tracking columns for agents

-- Main agent fields on tickets table
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS main_agent_compensation_base_value DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_included_hours INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_included_km INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_extra_hour_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_extra_km_rate DECIMAL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_total DECIMAL DEFAULT NULL;

-- Support agent fields on ticket_support_agents table
ALTER TABLE public.ticket_support_agents
  ADD COLUMN IF NOT EXISTS compensation_base_value DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_included_hours INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS compensation_included_km INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS compensation_extra_hour_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_extra_km_rate DECIMAL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS compensation_total DECIMAL DEFAULT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
