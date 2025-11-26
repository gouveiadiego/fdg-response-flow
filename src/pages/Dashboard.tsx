import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Users, UserCheck, TrendingUp } from 'lucide-react';

interface Stats {
  totalTickets: number;
  openTickets: number;
  totalClients: number;
  totalAgents: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    totalClients: 0,
    totalAgents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ticketsResult, openTicketsResult, clientsResult, agentsResult] = await Promise.all([
          supabase.from('tickets').select('*', { count: 'exact', head: true }),
          supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        ]);

        setStats({
          totalTickets: ticketsResult.count || 0,
          openTickets: openTicketsResult.count || 0,
          totalClients: clientsResult.count || 0,
          totalAgents: agentsResult.count || 0,
        });
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total de Chamados',
      value: stats.totalTickets,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Chamados Abertos',
      value: stats.openTickets,
      icon: TrendingUp,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Clientes Ativos',
      value: stats.totalClients,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Agentes Ativos',
      value: stats.totalAgents,
      icon: UserCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema de gestão de chamados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Sistema FDG Pronta Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Utilize o menu lateral para navegar entre as funcionalidades do sistema:
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <strong>Chamados:</strong> Gerencie todos os atendimentos e ocorrências
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <strong>Clientes:</strong> Cadastre e gerencie informações dos clientes
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <strong>Agentes:</strong> Controle a equipe de agentes disponíveis
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
