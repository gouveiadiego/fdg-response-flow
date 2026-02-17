-- Add arrival and departure times for main agent
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS main_agent_arrival TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS main_agent_departure TIMESTAMPTZ;
