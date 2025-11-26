-- Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'agente', 'cliente_visualizacao');

-- Criar enum para status de agente
CREATE TYPE public.agent_status AS ENUM ('ativo', 'inativo');

-- Criar enum para status de chamado
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_andamento', 'finalizado', 'cancelado');

-- Criar enum para tipo de serviço
CREATE TYPE public.service_type AS ENUM (
  'alarme',
  'averiguacao',
  'preservacao',
  'acompanhamento_logistico'
);

-- Tabela de roles de usuário (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operador',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de clientes
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  cep TEXT,
  default_coordinates_lat DECIMAL(10, 8),
  default_coordinates_lng DECIMAL(11, 8),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de veículos
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  plate_main TEXT NOT NULL,
  plate_trailer TEXT,
  type TEXT,
  color TEXT,
  year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de agentes
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  status agent_status NOT NULL DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de planos
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de chamados
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status ticket_status NOT NULL DEFAULT 'aberto',
  client_id UUID NOT NULL REFERENCES public.clients(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  main_agent_id UUID NOT NULL REFERENCES public.agents(id),
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  service_type service_type NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  coordinates_lat DECIMAL(10, 8),
  coordinates_lng DECIMAL(11, 8),
  km_start DECIMAL(10, 2),
  km_end DECIMAL(10, 2),
  toll_cost DECIMAL(10, 2) DEFAULT 0,
  food_cost DECIMAL(10, 2) DEFAULT 0,
  other_costs DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  summary TEXT,
  detailed_report TEXT,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de fotos dos chamados
CREATE TABLE public.ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_photos ENABLE ROW LEVEL SECURITY;

-- Função para verificar role do usuário (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.email
  );
  
  -- Adicionar role padrão de operador
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para calcular duração do chamado
CREATE OR REPLACE FUNCTION public.calculate_ticket_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_datetime IS NOT NULL AND NEW.start_datetime IS NOT NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_datetime - NEW.start_datetime)) / 60;
  END IF;
  
  -- Calcular total de custos
  NEW.total_cost = COALESCE(NEW.toll_cost, 0) + COALESCE(NEW.food_cost, 0) + COALESCE(NEW.other_costs, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculate_ticket_values BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.calculate_ticket_duration();

-- Função para gerar código do chamado
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_code TEXT;
BEGIN
  year_part := TO_CHAR(now(), 'YYYY');
  
  -- Buscar o último número de sequência do ano atual
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(code FROM 'PR-' || year_part || '-([0-9]+)') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.tickets
  WHERE code LIKE 'PR-' || year_part || '-%';
  
  new_code := 'PR-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  NEW.code := new_code;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_ticket_code_trigger BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_code();

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies para user_roles
CREATE POLICY "Usuários podem ver suas próprias roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem gerenciar roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para clients (operadores e admins podem gerenciar)
CREATE POLICY "Operadores e admins podem ver clientes"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Operadores e admins podem inserir clientes"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Operadores e admins podem atualizar clientes"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Admins podem deletar clientes"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para vehicles
CREATE POLICY "Operadores e admins podem ver veículos"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Operadores e admins podem gerenciar veículos"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

-- RLS Policies para agents
CREATE POLICY "Todos podem ver agentes ativos"
  ON public.agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operadores e admins podem gerenciar agentes"
  ON public.agents FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

-- RLS Policies para plans
CREATE POLICY "Todos podem ver planos"
  ON public.plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operadores e admins podem gerenciar planos"
  ON public.plans FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

-- RLS Policies para tickets
CREATE POLICY "Usuários podem ver chamados relevantes"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador') OR
    (public.has_role(auth.uid(), 'agente') AND main_agent_id IN (
      SELECT id FROM public.agents WHERE email = (
        SELECT email FROM public.profiles WHERE user_id = auth.uid()
      )
    ))
  );

CREATE POLICY "Operadores e admins podem criar chamados"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Operadores, admins e agentes podem atualizar seus chamados"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador') OR
    (public.has_role(auth.uid(), 'agente') AND main_agent_id IN (
      SELECT id FROM public.agents WHERE email = (
        SELECT email FROM public.profiles WHERE user_id = auth.uid()
      )
    ))
  );

-- RLS Policies para ticket_photos
CREATE POLICY "Usuários podem ver fotos de chamados que têm acesso"
  ON public.ticket_photos FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (SELECT id FROM public.tickets)
  );

CREATE POLICY "Usuários podem adicionar fotos aos chamados"
  ON public.ticket_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    ticket_id IN (SELECT id FROM public.tickets)
  );

-- Inserir dados iniciais de planos
INSERT INTO public.plans (name, category, description) VALUES
  ('1 Agente Armado', 'operacional', 'Atendimento com um agente armado'),
  ('1 Agente Desarmado', 'operacional', 'Atendimento com um agente desarmado'),
  ('2 Agentes Armados', 'operacional', 'Atendimento com dois agentes armados'),
  ('1 Armado + 1 Desarmado', 'operacional', 'Atendimento com um agente armado e um desarmado');