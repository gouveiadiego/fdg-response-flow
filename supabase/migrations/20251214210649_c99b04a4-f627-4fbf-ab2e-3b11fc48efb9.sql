-- Criar enum para tipos de carroceria
CREATE TYPE public.body_type_enum AS ENUM (
  'grade_baixa', 
  'grade_alta', 
  'bau', 
  'sider', 
  'frigorifico', 
  'container', 
  'prancha'
);

-- Alterar tabela vehicles para incluir novos campos
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS tractor_plate TEXT,
ADD COLUMN IF NOT EXISTS tractor_brand TEXT,
ADD COLUMN IF NOT EXISTS tractor_model TEXT,
ADD COLUMN IF NOT EXISTS trailer1_plate TEXT,
ADD COLUMN IF NOT EXISTS trailer1_body_type body_type_enum,
ADD COLUMN IF NOT EXISTS trailer2_plate TEXT,
ADD COLUMN IF NOT EXISTS trailer2_body_type body_type_enum,
ADD COLUMN IF NOT EXISTS trailer3_plate TEXT,
ADD COLUMN IF NOT EXISTS trailer3_body_type body_type_enum;

-- Alterar tabela agents para incluir novos campos
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS is_armed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;

-- Adicionar role cliente_visualizacao ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente_visualizacao';