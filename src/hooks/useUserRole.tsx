import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isOperador: boolean;
  isAgente: boolean;
  isClienteVisualizacao: boolean;
  isApproved: boolean;
  fetchError: boolean;
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsApproved(false);
      setFetchError(false);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        setFetchError(false);
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, is_approved')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar papel do usuário:', error);
          // If it's an auth error (JWT expired, etc.), flag it
          if (error.message?.includes('JWT') || error.code === 'PGRST301' || error.code === '401') {
            setFetchError(true);
          }
          setRole(null);
          setIsApproved(false);
        } else {
          setRole(data?.role || null);
          setIsApproved(data?.is_approved ?? false);
        }
      } catch (error) {
        console.error('Erro ao buscar papel do usuário:', error);
        setFetchError(true);
        setRole(null);
        setIsApproved(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isOperador: role === 'operador',
    isAgente: role === 'agente',
    isClienteVisualizacao: role === 'cliente_visualizacao',
    isApproved,
    fetchError,
  };
}