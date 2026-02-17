-- Add skill columns to agents table
ALTER TABLE agents ADD COLUMN has_alarm_skill BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN has_investigation_skill BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN has_preservation_skill BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN has_logistics_skill BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN has_auditing_skill BOOLEAN DEFAULT FALSE;

-- Update existing records to have FALSE as default
UPDATE agents SET 
  has_alarm_skill = FALSE,
  has_investigation_skill = FALSE,
  has_preservation_skill = FALSE,
  has_logistics_skill = FALSE,
  has_auditing_skill = FALSE
WHERE has_alarm_skill IS NULL;
