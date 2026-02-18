-- Tabela para cadastros de agentes via link público
CREATE TABLE public.agent_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  cep TEXT,
  is_armed BOOLEAN DEFAULT FALSE,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  has_alarm_skill BOOLEAN DEFAULT FALSE,
  has_investigation_skill BOOLEAN DEFAULT FALSE,
  has_preservation_skill BOOLEAN DEFAULT FALSE,
  has_logistics_skill BOOLEAN DEFAULT FALSE,
  has_auditing_skill BOOLEAN DEFAULT FALSE,
  pix_key TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  bank_account_type TEXT,
  notes TEXT,
  latitude FLOAT8,
  longitude FLOAT8,
  status TEXT NOT NULL DEFAULT 'pendente',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_agent_registrations_updated_at BEFORE UPDATE ON public.agent_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.agent_registrations ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (anon) pode inserir um cadastro
CREATE POLICY "Qualquer pessoa pode enviar cadastro"
  ON public.agent_registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Apenas operadores e admins podem visualizar
CREATE POLICY "Operadores e admins podem ver cadastros"
  ON public.agent_registrations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'operador')
  );

-- Apenas operadores e admins podem atualizar (aprovar/rejeitar)
CREATE POLICY "Operadores e admins podem atualizar cadastros"
  ON public.agent_registrations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'operador')
  );

-- Apenas admins podem deletar
CREATE POLICY "Admins podem deletar cadastros"
  ON public.agent_registrations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
