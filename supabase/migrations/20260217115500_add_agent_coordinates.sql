-- Add coordinate columns to agents table
ALTER TABLE agents ADD COLUMN latitude FLOAT8;
ALTER TABLE agents ADD COLUMN longitude FLOAT8;

-- Add comment for documentation
COMMENT ON COLUMN agents.latitude IS 'Latitude for map positioning';
COMMENT ON COLUMN agents.longitude IS 'Longitude for map positioning';
