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
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar papel do usuário:', error);
          setRole(null);
        } else {
          setRole(data?.role || null);
        }
      } catch (error) {
        console.error('Erro ao buscar papel do usuário:', error);
        setRole(null);
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
  };
}
