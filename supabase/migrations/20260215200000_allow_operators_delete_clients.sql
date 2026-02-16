-- Allow operators to delete clients
DROP POLICY IF EXISTS "Admins podem deletar clientes" ON public.clients;

CREATE POLICY "Admins e operadores podem deletar clientes"
  ON public.clients FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador')
  );
