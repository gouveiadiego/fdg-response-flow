-- Consolidated migration to fix any missing columns for Financeiro
-- This script adds all columns used in Agent Payments and Client Revenue

-- 1. AGENT COMPENSATION FIELDS
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS main_agent_compensation_base_value DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_included_hours DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_included_km DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_extra_hour_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_extra_km_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_compensation_total DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_agent_payment_status TEXT DEFAULT 'pendente' CHECK (main_agent_payment_status IN ('pendente', 'pago')),
  ADD COLUMN IF NOT EXISTS main_agent_paid_at TIMESTAMPTZ DEFAULT NULL;

-- 2. CLIENT REVENUE FIELDS
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS revenue_base_value DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_included_hours DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_included_km DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_extra_hour_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_extra_km_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_discount_addition DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_total DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revenue_status TEXT DEFAULT 'pendente' CHECK (revenue_status IN ('pendente', 'recebido')),
  ADD COLUMN IF NOT EXISTS revenue_paid_at TIMESTAMPTZ DEFAULT NULL;

-- 3. SUPPORT AGENT COMPENSATION AND STATUS
ALTER TABLE public.ticket_support_agents
  ADD COLUMN IF NOT EXISTS compensation_base_value DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_included_hours DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_included_km DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_extra_hour_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_extra_km_rate DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compensation_total DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
