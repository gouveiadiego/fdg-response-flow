-- Allow operators and admins to delete tickets
-- This was missing from the initial schema
CREATE POLICY "Operadores e admins podem deletar chamados"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );
