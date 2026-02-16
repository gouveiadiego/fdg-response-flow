-- Create enum for agent vehicle type
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_vehicle_type') THEN
    CREATE TYPE agent_vehicle_type AS ENUM ('carro', 'moto');
  END IF;
END $$;

-- Add vehicle_type column to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS vehicle_type agent_vehicle_type;

-- Update existing data if applicable (can leave null or set a default)
