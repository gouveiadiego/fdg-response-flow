-- Create operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Todos podem ver operadores"
  ON public.operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operadores e admins podem gerenciar operadores"
  ON public.operators FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );

-- Trigger for updated_at
CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add operator_id to tickets table
ALTER TABLE public.tickets ADD COLUMN operator_id UUID REFERENCES public.operators(id);
