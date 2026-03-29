import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, Users, UserCheck, TrendingUp,
  Calendar, Clock, Filter, AlertCircle, CheckCircle2, XCircle,
  DollarSign, Building2
} from 'lucide-react';
import {
  TrendChart,
  StatusDistributionChart,
  TopClientsChart,
  RankingChart
} from '@/components/dashboard/AnalyticsCharts';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import DashboardMap from '@/components/dashboard/DashboardMap';
import GoalProgress from '@/components/dashboard/GoalProgress';
import { DatePickerWithRange } from '@/components/dashboard/DateRangePicker';
import { format, subDays, startOfMonth, startOfYear, isWithinInterval, endOfDay, startOfDay, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { DateRange } from "react-day-picker";
import { useUserRole } from '@/hooks/useUserRole';
import { TicketDetails } from '@/components/tickets/TicketDetails';
import { EditTicketDialog } from '@/components/tickets/EditTicketDialog';

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
  pendingRevenue: number;
  receivedRevenue: number;
  totalProfit: number;
}

type FilterRange = '7days' | 'month' | 'year' | 'all' | 'custom';

const Dashboard = () => {
  const { isAdmin } = useUserRole();
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
    pendingRevenue: 0,
    receivedRevenue: 0,
    totalProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<FilterRange>('month');
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topClientsData, setTopClientsData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          clients(name),
          operators(name),
          ticket_support_agents(
            agent_id,
            toll_cost,
            food_cost,
            other_costs,
            compensation_total,
            payment_status
          )
        `);

      const [clientsResult, agentsResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
      ]);

      if (ticketsError) throw ticketsError;

      setAllTickets(tickets || []);

      // Filter by range or custom date
      const now = new Date();
      let filtered = tickets || [];

      let start: Date;
      let end: Date = endOfDay(now);

      if (range === 'custom' && date?.from) {
        start = startOfDay(date.from);
        if (date.to) end = endOfDay(date.to);

        filtered = (tickets || []).filter(t => {
          const ticketDate = new Date(t.created_at);
          return isWithinInterval(ticketDate, { start, end });
        });
      }

      setFilteredTickets(filtered);

      // Process Payment Stats

      // 1. Pending Payments (ALL TIME, finalizado status)
      const allTicketsData = tickets || [];
      const pendingTickets = allTicketsData.filter(t => t.status === 'finalizado');

      let pendingValue = 0;
      const pendingAgents = new Set<string>();

      pendingTickets.forEach(t => {
        // Main Agent
        if (t.main_agent_id && (t.main_agent_payment_status === 'pendente' || !t.main_agent_payment_status)) {
          const cost = (Number(t.main_agent_compensation_total) || 0) + 
                       (Number(t.toll_cost) || 0) + 
                       (Number(t.food_cost) || 0) + 
                       (Number(t.other_costs) || 0);
          pendingValue += cost;
          pendingAgents.add(t.main_agent_id);
        }

        // Dynamic Support Agents
        if (t.ticket_support_agents && t.ticket_support_agents.length > 0) {
          t.ticket_support_agents.forEach((sa: any) => {
            if (sa.payment_status === 'pendente' || !sa.payment_status) {
              const cost = (Number(sa.compensation_total) || 0) + 
                           (Number(sa.toll_cost) || 0) + 
                           (Number(sa.food_cost) || 0) + 
                           (Number(sa.other_costs) || 0);
              pendingValue += cost;
              pendingAgents.add(sa.agent_id);
            }
          });
        }
      });

      // 3. Revenue Stats (from ALL tickets for pending, filtered for received)
      let pRevenue = 0;
      let rRevenue = 0;

      allTicketsData.filter(t => t.status === 'finalizado').forEach(t => {
        if (!t.revenue_status || t.revenue_status === 'pendente') {
          pRevenue += (Number(t.revenue_total) || 0);
        }
      });

      filtered.filter(t => t.status === 'finalizado').forEach(t => {
        if (t.revenue_status === 'recebido') {
          rRevenue += (Number(t.revenue_total) || 0);
        }
      });

      // 4. Paid Payments (FILTERED by date range)
      let paidValue = 0;
      const paidAgents = new Set<string>();

      filtered.filter(t => t.status === 'finalizado').forEach(t => {
        // Main Agent
        if (t.main_agent_id && t.main_agent_payment_status === 'pago') {
          const cost = (Number(t.main_agent_compensation_total) || 0) + 
                       (Number(t.toll_cost) || 0) + 
                       (Number(t.food_cost) || 0) + 
                       (Number(t.other_costs) || 0);
          paidValue += cost;
          paidAgents.add(t.main_agent_id);
        }

        // Dynamic Support Agents
        if (t.ticket_support_agents && t.ticket_support_agents.length > 0) {
          t.ticket_support_agents.forEach((sa: any) => {
            if (sa.payment_status === 'pago') {
              const cost = (Number(sa.compensation_total) || 0) + 
                           (Number(sa.toll_cost) || 0) + 
                           (Number(sa.food_cost) || 0) + 
                           (Number(sa.other_costs) || 0);
              paidValue += cost;
              paidAgents.add(sa.agent_id);
            }
          });
        }
      });

      // Process Stats
      const statsObj: Stats = {
        totalTickets: filtered.length,
        openTickets: filtered.filter(t => t.status === 'aberto').length,
        completedTickets: filtered.filter(t => t.status === 'finalizado').length,
        cancelledTickets: filtered.filter(t => t.status === 'cancelado').length,
        totalClients: clientsResult.count || 0,
        totalAgents: agentsResult.count || 0,
        // Payment Stats
        pendingPaymentValue: pendingValue,
        pendingPaymentAgents: pendingAgents.size,
        paidPaymentValue: paidValue,
        paidPaymentAgents: paidAgents.size,
        // Revenue Stats
        pendingRevenue: pRevenue,
        receivedRevenue: rRevenue,
        totalProfit: (pRevenue + rRevenue) - (pendingValue + paidValue),
      };
      setStats(statsObj);

      // Process Trend Data (Last 7-10 entries of grouping)
      const dailyData: Record<string, number> = {};
      filtered.forEach(t => {
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
      filtered.forEach(t => {
        const name = (t.clients as any)?.name || 'Outros';
        clientMap[name] = (clientMap[name] || 0) + 1;
      });
      setTopClientsData(
        Object.entries(clientMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );

      // Process Operator Ranking (by completed tickets in filtered period)
      const operatorMap: Record<string, number> = {};
      filtered
        .filter(t => t.status === 'finalizado')
        .forEach(t => {
          const opName = (t.operators as any)?.name || (t.operator_id ? `Operador ${t.operator_id.slice(0, 6)}` : null);
          if (opName) operatorMap[opName] = (operatorMap[opName] || 0) + 1;
        });
      setRankingData(
        Object.entries(operatorMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 7)
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

  const handleViewDetails = (id: string) => {
    setSelectedTicketId(id);
    setDetailOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedTicketId(id);
    setEditOpen(true);
  };

  const statCards = [
    {
      title: 'Total de Chamados',
      value: stats.totalTickets,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      title: 'Em Aberto',
      value: stats.openTickets,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      title: 'Finalizados',
      value: stats.completedTickets,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      title: 'Cancelados',
      value: stats.cancelledTickets,
      icon: XCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-500/10',
    },
    {
      title: 'Pagamentos Pendentes',
      value: stats.pendingPaymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      subValue: `${stats.pendingPaymentAgents} agentes a receber`,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      isCurrency: true,
      hide: !isAdmin,
    },
    {
      title: 'Pagamentos Realizados',
      value: stats.paidPaymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      subValue: `${stats.paidPaymentAgents} agentes pagos`,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      isCurrency: true,
      hide: !isAdmin,
    },
    {
      title: 'Faturamento Pendente',
      value: stats.pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: DollarSign,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      isCurrency: true,
      hide: !isAdmin,
    },
    {
      title: 'Faturamento Recebido',
      value: stats.receivedRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: Building2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      isCurrency: true,
      hide: !isAdmin,
    },
    {
      title: 'Lucro Projetado',
      value: stats.totalProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      subValue: `Margem: ${((stats.totalProfit / (stats.pendingRevenue + stats.receivedRevenue || 1)) * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      isCurrency: true,
      hide: !isAdmin,
    },
  ];

  const filteredStatCards = statCards.filter(card => !card.hide);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo-fdg-premium.png" alt="Logo Falco" className="h-16 w-auto drop-shadow-lg animate-in zoom-in-75 duration-700" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              Analytics Falco
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStatCards.map((stat) => {
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

          {/* New Command Center Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-full">
              <DashboardMap tickets={allTickets} onViewDetails={handleViewDetails} />
            </div>
            <div className="lg:col-span-4 h-full">
              <ActivityFeed tickets={allTickets} onViewDetails={handleViewDetails} />
            </div>
          </div>

          {/* Monthly Goals Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GoalProgress 
              title="Atendimentos Mensais" 
              current={stats.completedTickets} 
              target={150} 
              icon="target"
              description="Meta de chamados finalizados este mês"
            />
            <GoalProgress 
              title="Eficiência Operacional" 
              current={Math.round((stats.completedTickets / (stats.totalTickets || 1)) * 100)} 
              target={95} 
              icon="efficiency"
              unit="%"
              description="Percentual de conclusão vs abertos"
            />
            <GoalProgress 
              title="Tempo Estimado de Chegada" 
              current={22} 
              target={15} 
              icon="zap"
              unit="min"
              description="Média de deslocamento dos agentes"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TrendChart data={trendData} title="Volume de Atendimentos" />
            <StatusDistributionChart data={statusData} title="Performance" />
            <TopClientsChart data={topClientsData} title="Top Clientes" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RankingChart data={rankingData} title="Ranking de Operadores — Chamados Finalizados" className="lg:col-span-2" />
            
            <Card className="shadow-md border-none bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Status da Rede Falco Peregrinus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-background/50 rounded-xl">
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

          {/* Modals for details and editing */}
          {selectedTicketId && (
            <>
              <TicketDetails
                ticketId={selectedTicketId}
                open={detailOpen}
                onOpenChange={setDetailOpen}
                onEdit={(id) => {
                  setDetailOpen(false);
                  handleEdit(id);
                }}
                onStatusChange={fetchDashboardData}
              />
              <EditTicketDialog
                ticketId={selectedTicketId}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSuccess={fetchDashboardData}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
