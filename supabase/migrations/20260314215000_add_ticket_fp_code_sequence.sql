-- 1. Create a sequence for the tickets
CREATE SEQUENCE IF NOT EXISTS public.ticket_fp_seq
  START WITH 1000
  INCREMENT BY 1
  MINVALUE 1000
  NO MAXVALUE
  CACHE 1;

-- 2. Create a function to auto-generate the code
CREATE OR REPLACE FUNCTION public.generate_ticket_fp_code()
RETURNS TRIGGER AS $$
BEGIN
  -- If the code is not provided during insert, auto-generate it
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'FP-' || nextval('public.ticket_fp_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a trigger to call the function BEFORE INSERT on tickets
DROP TRIGGER IF EXISTS trigger_generate_ticket_fp_code ON public.tickets;
CREATE TRIGGER trigger_generate_ticket_fp_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_fp_code();

-- 4. Retroactively apply codes to existing empty tickets
-- We use a DO block to loop through existing tickets and assign them a code
DO $$
DECLARE
  ticket_record RECORD;
BEGIN
  FOR ticket_record IN 
    SELECT id FROM public.tickets WHERE code IS NULL OR code = '' ORDER BY created_at ASC
  LOOP
    UPDATE public.tickets
    SET code = 'FP-' || nextval('public.ticket_fp_seq')
    WHERE id = ticket_record.id;
  END LOOP;
END;
$$;

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
