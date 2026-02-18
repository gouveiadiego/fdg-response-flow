-- Add payment tracking fields to tickets table
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS main_agent_payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS main_agent_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_agent_1_payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS support_agent_1_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_agent_2_payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS support_agent_2_paid_at timestamptz;
