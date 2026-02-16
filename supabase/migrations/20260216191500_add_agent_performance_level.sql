-- Create enum for agent performance level
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_performance_level') THEN
    CREATE TYPE agent_performance_level AS ENUM ('ruim', 'bom', 'otimo');
  END IF;
END $$;

-- Add performance_level column to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS performance_level agent_performance_level DEFAULT 'bom';

-- Update RLS if needed (usually not for simple column addition if table RLS is already broad)
-- Assuming admin and operador can update this field.
