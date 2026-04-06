import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, Users, UserCheck, TrendingUp,
  Calendar, Clock, Filter, AlertCircle, CheckCircle2, XCircle,
  DollarSign, Building2, Zap, Activity, ArrowUpRight, ArrowDownRight,
  Wallet, Layers, MapPin
} from 'lucide-react';
import {
  StatusDistributionChart,
  TopClientsChart
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
import { Badge } from '@/components/ui/badge';

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
  // Live Status
  activeAgentsInField: number;
  emergencyTickets: number;
}

type FilterRange = '7days' | 'month' | 'year' | 'all' | 'custom';

const Dashboard = () => {
  const { isAdmin } = useUserRole();
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0, openTickets: 0, totalClients: 0, totalAgents: 0,
    completedTickets: 0, cancelledTickets: 0, pendingPaymentValue: 0,
    pendingPaymentAgents: 0, paidPaymentValue: 0, paidPaymentAgents: 0,
    pendingRevenue: 0, receivedRevenue: 0, totalProfit: 0,
    activeAgentsInField: 0, emergencyTickets: 0
  });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<FilterRange>('month');
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topClientsData, setTopClientsData] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          clients(name),
          operators(name),
          ticket_support_agents(*)
        `);

      const [clientsResult, agentsResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
      ]);

      if (ticketsError) throw ticketsError;
      setAllTickets(tickets || []);

      const now = new Date();
      let filtered = (tickets || []).filter(t => {
        const ticketDate = new Date(t.created_at);
        if (range === 'custom' && date?.from) {
          const start = startOfDay(date.from);
          const end = date.to ? endOfDay(date.to) : endOfDay(now);
          return isWithinInterval(ticketDate, { start, end });
        }
        if (range === 'all') return true;
        const start = range === '7days' ? subDays(now, 7) : range === 'month' ? startOfMonth(now) : startOfYear(now);
        return isWithinInterval(ticketDate, { start, end: endOfDay(now) });
      });

      // Financial Calculation
      const finishedTickets = tickets?.filter(t => t.status === 'finalizado') || [];
      let pendingValue = 0, paidValue = 0, pRevenue = 0, rRevenue = 0;
      const pendingAgentsSet = new Set<string>(), paidAgentsSet = new Set<string>();

      finishedTickets.forEach(t => {
        // Costs
        const calcCost = (c: any) => (Number(c.compensation_total) || 0) + (Number(c.toll_cost) || 0) + (Number(c.food_cost) || 0) + (Number(c.other_costs) || 0);
        
        // Pendent Main
        if (t.main_agent_id && (t.main_agent_payment_status === 'pendente' || !t.main_agent_payment_status)) {
          pendingValue += calcCost(t);
          pendingAgentsSet.add(t.main_agent_id);
        } else if (t.main_agent_id && t.main_agent_payment_status === 'pago') {
          paidValue += calcCost(t);
          paidAgentsSet.add(t.main_agent_id);
        }

        // Support
        if (t.ticket_support_agents) {
          t.ticket_support_agents.forEach((sa: any) => {
            if (sa.payment_status === 'pago') {
               paidValue += calcCost(sa);
               paidAgentsSet.add(sa.agent_id);
            } else {
               pendingValue += calcCost(sa);
               pendingAgentsSet.add(sa.agent_id);
            }
          });
        }

        // Revenue
        if (!t.revenue_status || t.revenue_status === 'pendente') pRevenue += (Number(t.revenue_total) || 0);
        else if (t.revenue_status === 'recebido') rRevenue += (Number(t.revenue_total) || 0);
      });

      const openNow = tickets?.filter(t => t.status === 'aberto' || t.status === 'em_andamento') || [];
      const activeAgents = new Set(openNow.map(t => t.main_agent_id)).size;

      setStats({
        totalTickets: filtered.length,
        openTickets: filtered.filter(t => t.status === 'aberto').length,
        completedTickets: filtered.filter(t => t.status === 'finalizado').length,
        cancelledTickets: filtered.filter(t => t.status === 'cancelado').length,
        totalClients: clientsResult.count || 0,
        totalAgents: agentsResult.count || 0,
        pendingPaymentValue: pendingValue,
        pendingPaymentAgents: pendingAgentsSet.size,
        paidPaymentValue: paidValue,
        paidPaymentAgents: paidAgentsSet.size,
        pendingRevenue: pRevenue,
        receivedRevenue: rRevenue,
        totalProfit: (pRevenue + rRevenue) - (pendingValue + paidValue),
        activeAgentsInField: activeAgents,
        emergencyTickets: openNow.length
      });

      setStatusData([
        { name: 'Finalizados', value: filtered.filter(t => t.status === 'finalizado').length },
        { name: 'Em Aberto', value: filtered.filter(t => t.status === 'aberto').length },
        { name: 'Cancelados', value: filtered.filter(t => t.status === 'cancelado').length },
      ]);

      const clientMap: Record<string, number> = {};
      filtered.forEach(t => {
        const name = (t.clients as any)?.name || 'Outros';
        clientMap[name] = (clientMap[name] || 0) + 1;
      });
      setTopClientsData(Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5));

    } catch (err) {
      console.error('Erro dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, [range, date]);

  const handleEdit = (id: string) => { setSelectedTicketId(id); setEditOpen(true); };
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl shadow-inner"><Activity className="h-8 w-8 text-primary" /></div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Centro de Operações</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Pulse: Monitoramento em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card p-1 px-3 rounded-xl shadow-sm border">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={range} onValueChange={(v: FilterRange) => setRange(v)}>
              <SelectTrigger className="w-[140px] border-none focus:ring-0 shadow-none bg-transparent h-9 p-0"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="all">Todo o Período</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === 'custom' && <DatePickerWithRange date={date} setDate={setDate} className="animate-in slide-in-from-right-2 duration-300" />}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">{[1,2,3,4].map(i => <Card key={i} className="animate-pulse border-none bg-muted/50 h-32" />)}</div>
      ) : (
        <>
          {/* ── LIVE PULSE & OPERATIONAL GRID ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
             <Card className="border-none shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white col-span-2">
                <CardContent className="p-6">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="text-xs font-bold uppercase opacity-70 tracking-widest">Atendimentos Ativos</p>
                         <h3 className="text-4xl font-black mt-1">{stats.emergencyTickets}</h3>
                         <p className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full font-bold">EM CAMPO AGORA</p>
                      </div>
                      <Zap className="h-8 w-8 text-amber-400 fill-amber-400" />
                   </div>
                </CardContent>
             </Card>

             {[
               { label: 'Agentes Prontidão', val: stats.totalAgents, sub: `${stats.activeAgentsInField} em serviço`, icon: <UserCheck className="h-4 w-4 text-emerald-500" />, bg: 'bg-emerald-50/50' },
               { label: 'Abertos no Período', val: stats.openTickets, sub: 'atendimento pendente', icon: <Clock className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-50/50' },
               { label: 'Finalizados', val: stats.completedTickets, sub: 'operações concluídas', icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />, bg: 'bg-blue-50/50' },
               { label: 'Clientes Ativos', val: stats.totalClients, sub: 'base cadastrada', icon: <Users className="h-4 w-4 text-indigo-500" />, bg: 'bg-indigo-50/50' },
             ].map((c, i) => (
               <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all bg-card overflow-hidden">
                  <CardHeader className="pb-1">
                     <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">{c.icon}{c.label}</p>
                  </CardHeader>
                  <CardContent>
                     <p className="text-2xl font-black">{c.val}</p>
                     <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{c.sub}</p>
                  </CardContent>
               </Card>
             ))}
          </div>

          {/* ── COMMAND CENTER MAP & FEED ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-[550px]"><DashboardMap tickets={allTickets} onViewDetails={(id) => { setSelectedTicketId(id); setDetailOpen(true); }} /></div>
            <div className="lg:col-span-4 h-[550px]"><ActivityFeed tickets={allTickets} onViewDetails={(id) => { setSelectedTicketId(id); setDetailOpen(true); }} /></div>
          </div>

          {/* ── FINANCIAL HEALTH & GOALS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* Painel de Saúde Financeira Premium */}
             {isAdmin && (
               <Card className="lg:col-span-12 border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative group">
                  <div className="absolute right-0 top-0 h-full w-1/3 bg-primary/10 -skew-x-12 translate-x-1/2 group-hover:translate-x-1/3 transition-transform duration-1000" />
                  <CardHeader className="relative z-10 border-b border-white/10 flex flex-row items-center justify-between pb-4">
                     <CardTitle className="text-lg flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-emerald-400" /> Saúde Financeira do Período
                     </CardTitle>
                     <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10">Visão CFO</Badge>
                  </CardHeader>
                  <CardContent className="p-8 relative z-10 grid grid-cols-1 md:grid-cols-4 gap-8">
                     <div className="md:col-span-1 space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Saldo Operacional Real</p>
                        <h2 className={`text-4xl font-black ${stats.receivedRevenue - stats.paidPaymentValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {fmt(stats.receivedRevenue - stats.paidPaymentValue)}
                        </h2>
                        <p className="text-[10px] text-slate-500 mt-2">Baseado no fluxo de caixa atual (Recebido − Pago)</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4 col-span-2 border-x border-white/5 px-8">
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> Receitas</p>
                           <div className="space-y-4">
                              <div><p className="text-[10px] text-slate-500 mb-0.5">Líquido Recebido</p><p className="text-lg font-black text-emerald-400">{fmt(stats.receivedRevenue)}</p></div>
                              <div><p className="text-[10px] text-slate-500 mb-0.5">A Receber de Clientes</p><p className="text-lg font-black text-slate-300">{fmt(stats.pendingRevenue)}</p></div>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5"><ArrowDownRight className="h-3 w-3 text-rose-500" /> Despesas</p>
                           <div className="space-y-4">
                              <div><p className="text-[10px] text-slate-500 mb-0.5">Custos Pagos</p><p className="text-lg font-black text-rose-400">{fmt(stats.paidPaymentValue)}</p></div>
                              <div><p className="text-[10px] text-slate-500 mb-0.5">A Pagar (Agentes)</p><p className="text-lg font-black text-slate-300">{fmt(stats.pendingPaymentValue)}</p></div>
                           </div>
                        </div>
                     </div>

                     <div className="flex flex-col justify-center items-center bg-white/5 rounded-2xl p-4 border border-white/5">
                        <div className="text-center">
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Margem de Lucro Real</p>
                           <div className="relative inline-flex items-center justify-center">
                              <svg className="w-20 h-20"><circle className="text-slate-700" strokeWidth="5" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40"/><circle className="text-emerald-500" strokeWidth="5" strokeDasharray={188.4} strokeDashoffset={188.4 - (188.4 * Math.min(100, Math.max(0, (stats.totalProfit / (stats.pendingRevenue + stats.receivedRevenue || 1)) * 100))) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40"/></svg>
                              <span className="absolute text-sm font-black">{((stats.totalProfit / (stats.pendingRevenue + stats.receivedRevenue || 1)) * 100).toFixed(1)}%</span>
                           </div>
                        </div>
                     </div>
                  </CardContent>
               </Card>
             )}

             <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <GoalProgress title="Atendimentos Mensais" current={stats.completedTickets} target={150} icon="target" description="Meta de chamados finalizados" />
                <GoalProgress title="Eficiência Operacional" current={Math.round((stats.completedTickets / (stats.totalTickets || 1)) * 100)} target={95} icon="efficiency" unit="%" description="Percentual de conclusão" />
                <GoalProgress title="Tempo de Resposta" current={22} target={15} icon="zap" unit="min" description="Média de chegada ao local" />
             </div>

             <div className="lg:col-span-4 h-full">
                <StatusDistributionChart data={statusData} title="Distribuição de Status" className="h-full" />
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <TopClientsChart data={topClientsData} title="Concentração por Cliente" />
             <Card className="shadow-md border-none bg-gradient-to-br from-primary/5 to-indigo-500/5 overflow-hidden">
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Ativação da Rede Falco</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                   <div className="flex items-center justify-between p-5 bg-card border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4"><div className="p-3 bg-blue-100 rounded-xl"><Users className="h-6 w-6 text-blue-600" /></div><div><p className="text-xl font-black">{stats.totalClients}</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Clientes em Carteira</p></div></div>
                      <div className="flex items-center gap-4 text-right"><div><p className="text-xl font-black">{stats.totalAgents}</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Agentes Disponíveis</p></div><div className="p-3 bg-emerald-100 rounded-xl"><UserCheck className="h-6 w-6 text-emerald-600" /></div></div>
                   </div>
                   <div className="p-5 bg-primary/5 rounded-2xl border-l-4 border-primary"><p className="text-sm font-medium italic text-slate-600 dark:text-slate-300">"Priorizando a excelência operacional e a agilidade em cada chamado operacionalizado."</p></div>
                </CardContent>
             </Card>
          </div>

          {selectedTicketId && (
            <>
              <TicketDetails ticketId={selectedTicketId} open={detailOpen} onOpenChange={setDetailOpen} onEdit={(id) => { setDetailOpen(false); handleEdit(id); }} onStatusChange={fetchDashboardData} />
              <EditTicketDialog ticketId={selectedTicketId} open={editOpen} onOpenChange={setEditOpen} onSuccess={fetchDashboardData} />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
