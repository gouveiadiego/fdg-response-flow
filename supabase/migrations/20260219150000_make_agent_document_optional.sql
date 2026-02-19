-- Make document (CPF) optional in agents table
ALTER TABLE public.agents ALTER COLUMN document DROP NOT NULL;

-- Make document (CPF) optional in agent_registrations table
ALTER TABLE public.agent_registrations ALTER COLUMN document DROP NOT NULL;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
