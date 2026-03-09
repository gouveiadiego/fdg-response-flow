-- Add revenue calculation fields to tickets table
-- This allows flexible, per-ticket billing parameters and calculation

ALTER TABLE public.tickets
  ADD COLUMN revenue_base_value DECIMAL(10, 2) DEFAULT 500.00,
  ADD COLUMN revenue_included_hours DECIMAL(10, 2) DEFAULT 3.00,
  ADD COLUMN revenue_included_km DECIMAL(10, 2) DEFAULT 50.00,
  ADD COLUMN revenue_extra_hour_rate DECIMAL(10, 2) DEFAULT 90.00,
  ADD COLUMN revenue_extra_km_rate DECIMAL(10, 2) DEFAULT 2.50,
  ADD COLUMN revenue_discount_addition DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN revenue_total DECIMAL(10, 2) DEFAULT 0.00;
