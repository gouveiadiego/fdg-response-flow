import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, Users, UserCheck, TrendingUp,
  Calendar, Clock, Filter, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import {
  TrendChart,
  StatusDistributionChart,
  TopClientsChart
} from '@/components/dashboard/AnalyticsCharts';
import { DatePickerWithRange } from '@/components/dashboard/DateRangePicker';
import { format, subDays, startOfMonth, startOfYear, isWithinInterval, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { DateRange } from "react-day-picker";

interface Stats {
  totalTickets: number;
  openTickets: number;
  totalClients: number;
  totalAgents: number;
  completedTickets: number;
  cancelledTickets: number;
  // Payment Stats
  pendingPaymentValue: number;
  pendingPaymentAgents: number;
  paidPaymentValue: number;
  paidPaymentAgents: number;
}

type FilterRange = '7days' | 'month' | 'year' | 'all' | 'custom';

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    totalClients: 0,
    totalAgents: 0,
    completedTickets: 0,
    cancelledTickets: 0,
    pendingPaymentValue: 0,
    pendingPaymentAgents: 0,
    paidPaymentValue: 0,
    paidPaymentAgents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<FilterRange>('month');
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topClientsData, setTopClientsData] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          clients(name),
          ticket_support_agents(
            agent_id,
            toll_cost,
            food_cost,
            other_costs,
            payment_status
          )
        `);

      const [clientsResult, agentsResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
      ]);

      if (ticketsError) throw ticketsError;

      // Filter by range or custom date
      const now = new Date();
      let filteredTickets = tickets || [];

      let start: Date;
      let end: Date = endOfDay(now);

      if (range === 'custom' && date?.from) {
        start = startOfDay(date.from);
        if (date.to) end = endOfDay(date.to);

        filteredTickets = (tickets || []).filter(t => {
          const ticketDate = new Date(t.created_at);
          return isWithinInterval(ticketDate, { start, end });
        });
      } else if (range !== 'all') {
        start = range === '7days' ? subDays(now, 7) :
          range === 'month' ? startOfMonth(now) :
            startOfYear(now);

        filteredTickets = (tickets || []).filter(t => {
          const ticketDate = new Date(t.created_at);
          return isWithinInterval(ticketDate, { start, end });
        });
      }

      // Process Payment Stats

      // 1. Pending Payments (ALL TIME, finalizado status)
      const allTickets = tickets || [];
      const pendingTickets = allTickets.filter(t => t.status === 'finalizado');

      let pendingValue = 0;
      const pendingAgents = new Set<string>();

      pendingTickets.forEach(t => {
        // Main Agent
        if (t.main_agent_id && (t.main_agent_payment_status === 'pendente' || !t.main_agent_payment_status)) {
          const cost = (Number(t.toll_cost) || 0) + (Number(t.food_cost) || 0) + (Number(t.other_costs) || 0);
          pendingValue += cost;
          pendingAgents.add(t.main_agent_id);
        }

        // Dynamic Support Agents
        if (t.ticket_support_agents && t.ticket_support_agents.length > 0) {
          t.ticket_support_agents.forEach((sa: any) => {
            if (sa.payment_status === 'pendente' || !sa.payment_status) {
              const cost = (Number(sa.toll_cost) || 0) + (Number(sa.food_cost) || 0) + (Number(sa.other_costs) || 0);
              pendingValue += cost;
              pendingAgents.add(sa.agent_id);
            }
          });
        }
      });

      // 2. Paid Payments (FILTERED by date range)
      const paidTickets = filteredTickets.filter(t => t.status === 'finalizado');

      let paidValue = 0;
      const paidAgents = new Set<string>();

      paidTickets.forEach(t => {
        // Main Agent
        if (t.main_agent_id && t.main_agent_payment_status === 'pago') {
          const cost = (Number(t.toll_cost) || 0) + (Number(t.food_cost) || 0) + (Number(t.other_costs) || 0);
          paidValue += cost;
          paidAgents.add(t.main_agent_id);
        }

        // Dynamic Support Agents
        if (t.ticket_support_agents && t.ticket_support_agents.length > 0) {
          t.ticket_support_agents.forEach((sa: any) => {
            if (sa.payment_status === 'pago') {
              const cost = (Number(sa.toll_cost) || 0) + (Number(sa.food_cost) || 0) + (Number(sa.other_costs) || 0);
              paidValue += cost;
              paidAgents.add(sa.agent_id);
            }
          });
        }
      });

      // Process Stats
      const statsObj: Stats = {
        totalTickets: filteredTickets.length,
        openTickets: filteredTickets.filter(t => t.status === 'aberto').length,
        completedTickets: filteredTickets.filter(t => t.status === 'finalizado').length,
        cancelledTickets: filteredTickets.filter(t => t.status === 'cancelado').length,
        totalClients: clientsResult.count || 0,
        totalAgents: agentsResult.count || 0,
        // Payment Stats
        pendingPaymentValue: pendingValue,
        pendingPaymentAgents: pendingAgents.size,
        paidPaymentValue: paidValue,
        paidPaymentAgents: paidAgents.size,
      };
      setStats(statsObj);

      // Process Trend Data (Last 7-10 entries of grouping)
      const dailyData: Record<string, number> = {};
      filteredTickets.forEach(t => {
        const day = format(new Date(t.created_at), 'dd/MM');
        dailyData[day] = (dailyData[day] || 0) + 1;
      });
      setTrendData(Object.entries(dailyData).map(([name, value]) => ({ name, value })));

      // Process Status Distribution
      setStatusData([
        { name: 'Finalizados', value: statsObj.completedTickets },
        { name: 'Em Aberto', value: statsObj.openTickets },
        { name: 'Cancelados', value: statsObj.cancelledTickets },
      ]);

      // Process Top Clients
      const clientMap: Record<string, number> = {};
      filteredTickets.forEach(t => {
        const name = (t.clients as any)?.name || 'Outros';
        clientMap[name] = (clientMap[name] || 0) + 1;
      });
      setTopClientsData(
        Object.entries(clientMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range, date]);

  const statCards = [
    {
      title: 'Total de Chamados',
      value: stats.totalTickets,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Em Aberto',
      value: stats.openTickets,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Finalizados',
      value: stats.completedTickets,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Cancelados',
      value: stats.cancelledTickets,
      icon: XCircle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      title: 'Pagamentos Pendentes',
      value: stats.pendingPaymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      subValue: `${stats.pendingPaymentAgents} agentes a receber`,
      icon: Clock, // Reusing Clock icon or maybe DollarSign?
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      isCurrency: true,
    },
    {
      title: 'Pagamentos Realizados',
      value: stats.paidPaymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      subValue: `${stats.paidPaymentAgents} agentes pagos`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      isCurrency: true,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo-fdg-premium.png" alt="Logo FDG" className="h-16 w-auto drop-shadow-lg animate-in zoom-in-75 duration-700" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              Analytics FDG
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestão inteligente e visualização de performance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card p-1 px-2 rounded-xl shadow-sm border">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={range} onValueChange={(v: FilterRange) => setRange(v)}>
              <SelectTrigger className="w-[140px] border-none focus:ring-0 shadow-none bg-transparent h-8 p-0">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="all">Todo o Período</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {range === 'custom' && (
            <DatePickerWithRange
              date={date}
              setDate={setDate}
              className="animate-in slide-in-from-right-2 duration-300"
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse border-none bg-muted/50 h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="group border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-xl transition-colors group-hover:scale-110 duration-300 ${stat.bgColor}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={stat.isCurrency ? "text-2xl font-black" : "text-3xl font-black"}>
                      {stat.value}
                    </div>
                    {stat.subValue && (
                      <div className="text-xs font-medium text-muted-foreground mt-1">
                        {stat.subValue}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      <span>Atualizado em tempo real</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TrendChart data={trendData} title="Volume de Atendimentos" />
            <StatusDistributionChart data={statusData} title="Performance" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopClientsChart data={topClientsData} title="Top Clientes" />

            <Card className="lg:col-span-2 shadow-md border-none bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Status da Rede FDG
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-semibold">{stats.totalClients}</p>
                      <p className="text-xs text-muted-foreground">Clientes na base</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="font-semibold">{stats.totalAgents}</p>
                      <p className="text-xs text-muted-foreground">Agentes de prontidão</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Otimizando a resposta rápida com dados em tempo real."
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
