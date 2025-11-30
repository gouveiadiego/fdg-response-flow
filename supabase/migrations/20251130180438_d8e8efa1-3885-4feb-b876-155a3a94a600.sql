
-- Criar bucket para fotos de chamados
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Usuários autenticados podem ver fotos de chamados"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar suas fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'ticket-photos' AND auth.role() = 'authenticated');
