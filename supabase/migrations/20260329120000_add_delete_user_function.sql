-- Função para deletar usuário (RPC) com acesso SECURITY DEFINER para remover de auth.users
-- EXCLUSIVO para Administradores
CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    is_admin BOOLEAN;
    caller_id UUID;
BEGIN
    caller_id := auth.uid();
    
    -- 1. Verificar se o chamador é um administrador
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = caller_id AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- 2. Impedir auto-exclusão
    IF caller_id = target_user_id THEN
        RAISE EXCEPTION 'Você não pode excluir sua própria conta.';
    END IF;

    -- 3. Deletar da tabela de autenticação (isso acionará o CASCADE em profiles e user_roles)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao deletar usuário: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Garantir que a função possa ser executada por usuários autenticados (a lógica interna verifica se é admin)
GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO service_role;
