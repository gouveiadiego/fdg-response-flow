-- Grant explicit permissions to ensure visibility
GRANT ALL ON public.ticket_support_agents TO authenticated;
GRANT ALL ON public.ticket_support_agents TO service_role;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
