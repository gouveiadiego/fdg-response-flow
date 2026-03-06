-- Add missing DELETE policy for ticket_photos table
-- Without this, authenticated users cannot delete photos even though they can insert/select them

CREATE POLICY "Usuários podem deletar fotos de chamados que têm acesso"
  ON public.ticket_photos FOR DELETE
  TO authenticated
  USING (
    ticket_id IN (SELECT id FROM public.tickets)
  );

-- Also add UPDATE policy for completeness
CREATE POLICY "Usuários podem atualizar fotos de chamados que têm acesso"
  ON public.ticket_photos FOR UPDATE
  TO authenticated
  USING (
    ticket_id IN (SELECT id FROM public.tickets)
  );
