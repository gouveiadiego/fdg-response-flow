-- Migration: Add per-agent tracking columns for support agents

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS support_agent_1_km_start float8,
ADD COLUMN IF NOT EXISTS support_agent_1_km_end float8,
ADD COLUMN IF NOT EXISTS support_agent_1_toll_cost float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_agent_1_food_cost float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_agent_1_other_costs float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_agent_2_km_start float8,
ADD COLUMN IF NOT EXISTS support_agent_2_km_end float8,
ADD COLUMN IF NOT EXISTS support_agent_2_toll_cost float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_agent_2_food_cost float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_agent_2_other_costs float8 DEFAULT 0;

-- Optional: Add comments to explain columns
COMMENT ON COLUMN tickets.km_start IS 'Main agent start KM';
COMMENT ON COLUMN tickets.km_end IS 'Main agent end KM';
COMMENT ON COLUMN tickets.toll_cost IS 'Main agent toll costs';
COMMENT ON COLUMN tickets.food_cost IS 'Main agent food costs';
COMMENT ON COLUMN tickets.other_costs IS 'Main agent other costs';
