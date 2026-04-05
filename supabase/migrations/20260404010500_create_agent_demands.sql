-- Create enum for agent demands status
CREATE TYPE public.demand_status AS ENUM ('pendente', 'resolvida');

-- Create agent_demands table
CREATE TABLE IF NOT EXISTS public.agent_demands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    notes TEXT,
    status public.demand_status DEFAULT 'pendente'::public.demand_status NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Set up RLS
ALTER TABLE public.agent_demands ENABLE ROW LEVEL SECURITY;

-- Policies for agent_demands
CREATE POLICY "Users can view agent_demands" 
    ON public.agent_demands FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert agent_demands" 
    ON public.agent_demands FOR INSERT 
    WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update agent_demands" 
    ON public.agent_demands FOR UPDATE 
    USING (true);

CREATE POLICY "Users can delete agent_demands" 
    ON public.agent_demands FOR DELETE 
    USING (auth.uid() = created_by_user_id OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'operador')
    ));
