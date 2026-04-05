import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
    Users, UserCheck, Clock, TrendingUp, Calendar,
    BarChart3, Award, Zap, Timer, PieChart as PieChartIcon,
    DollarSign, Activity, Target, Layers, ArrowUpRight, ArrowDownRight,
    AlertTriangle, Wallet, MapPin, Building2, Truck
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import {
    format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear,
    isWithinInterval, differenceInMinutes, parseISO, subMonths, subYears
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerWithRange } from '@/components/dashboard/DateRangePicker';
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';

const serviceTypeLabels: Record<string, string> = {
    alarme: 'Alarme',
    averiguacao: 'Averiguação',
    preservacao: 'Preservação',
    acompanhamento_logistico: 'Acomp. Logístico',
    sindicancia: 'Sindicância',
};

interface AgentPerformance { id: string; name: string; count: number; avgTime: number; }
interface RegionPerformance { city: string; state: string; count: number; }
interface OperatorPerformance { id: string; name: string; count: number; }
type FilterRange = '7days' | 'month' | 'year' | 'all' | 'custom';

const Performance = () => {
    const { isAdmin } = useUserRole();
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<FilterRange>('month');
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: new Date() });

    const [agentRanking, setAgentRanking] = useState<AgentPerformance[]>([]);
    const [operatorRanking, setOperatorRanking] = useState<OperatorPerformance[]>([]);
    const [regionRanking, setRegionRanking] = useState<RegionPerformance[]>([]);
    const [serviceDistribution, setServiceDistribution] = useState<any[]>([]);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [serviceRevenueData, setServiceRevenueData] = useState<any[]>([]);

    const [globalStats, setGlobalStats] = useState({ avgCompletionTime: 0, totalFinished: 0, successRate: 0, totalKm: 0 });
    const [financialStats, setFinancialStats] = useState({
        faturamentoBruto: 0, custoTotal: 0, lucroBruto: 0, margemLucro: 0,
        ticketMedio: 0, custoPorVenda: 0, pontoEquilibrio: 0, laborCostPct: 0,
        inadimplencia: 0, valorInadimplente: 0, saldoOperacional: 0,
        totalChamados: 0, prevFaturamento: 0, growthRevenue: 0, prevFinished: 0, growthTickets: 0,
    });

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtMin = (min: number) => min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;

    const GrowthBadge = ({ pct }: { pct: number }) => {
        if (!pct || pct === 0) return null;
        const up = pct > 0;
        return (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'text-emerald-300 bg-emerald-500/20' : 'text-red-300 bg-red-500/20'}`}>
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(pct).toFixed(1)}%
            </span>
        );
    };

    const fetchPerformanceData = async () => {
        setLoading(true);
        try {
            const { data: tickets, error } = await supabase.from('tickets').select(`
                *, main_agent:agents!tickets_main_agent_id_fkey(name), operator:operators(name),
                ticket_support_agents(km_start, km_end, compensation_total, toll_cost, food_cost, other_costs)
            `);
            if (error) throw error;

            const { data: allOperators } = await (supabase.from('operators' as any) as any).select('id, name');
            const opNameMap = Object.fromEntries(((allOperators as any[]) || []).map((o: any) => [o.id, o.name]));

            const now = new Date();
            let filtered = tickets || [];

            if (range === 'custom' && date?.from) {
                filtered = (tickets || []).filter(t => isWithinInterval(new Date(t.created_at), { start: date.from!, end: date.to || now }));
            } else if (range !== 'all') {
                const start = range === '7days' ? subDays(now, 7) : range === 'month' ? startOfMonth(now) : startOfYear(now);
                filtered = (tickets || []).filter(t => isWithinInterval(new Date(t.created_at), { start, end: now }));
            }

            // Previous period
            let prevRevenue = 0, prevFinishedCount = 0;
            if (range !== 'all' && range !== 'custom') {
                const [ps, pe] = range === '7days'
                    ? [subDays(now, 14), subDays(now, 7)]
                    : range === 'month'
                    ? [subMonths(startOfMonth(now), 1), endOfMonth(subMonths(now, 1))]
                    : [subYears(startOfYear(now), 1), endOfYear(subYears(now, 1))];
                const prevFinished = (tickets || []).filter(t => {
                    const d = new Date(t.created_at);
                    return d >= ps && d <= pe && t.status === 'finalizado';
                });
                prevRevenue = prevFinished.reduce((s, t) => s + (Number(t.revenue_total) || 0), 0);
                prevFinishedCount = prevFinished.length;
            }

            const finishedTickets = filtered.filter(t => t.status === 'finalizado');

            const agentMap: Record<string, { name: string; count: number; totalMinutes: number }> = {};
            const regionMap: Record<string, { city: string; state: string; count: number }> = {};
            const serviceMap: Record<string, number> = {};
            const serviceRevMap: Record<string, { revenue: number; cost: number }> = {};
            const monthlyMap: Record<string, { revenue: number; cost: number; count: number }> = {};
            let totalKm = 0, totalRevenue = 0, totalCost = 0;

            finishedTickets.forEach(t => {
                const agentId = t.main_agent_id;
                const agentName = (t.main_agent as any)?.name || 'Desconhecido';
                if (!agentMap[agentId]) agentMap[agentId] = { name: agentName, count: 0, totalMinutes: 0 };
                agentMap[agentId].count += 1;
                if (t.created_at && t.end_datetime) {
                    const diff = differenceInMinutes(parseISO(t.end_datetime), parseISO(t.created_at));
                    if (diff > 0) agentMap[agentId].totalMinutes += diff;
                }

                const rev = Number(t.revenue_total) || 0;
                totalRevenue += rev;

                const mainCost = (Number(t.main_agent_compensation_total) || 0) + (Number(t.toll_cost) || 0) + (Number(t.food_cost) || 0) + (Number(t.other_costs) || 0);
                totalCost += mainCost;
                totalKm += Math.max(0, (Number(t.km_end) || 0) - (Number(t.km_start) || 0));

                let ticketCost = mainCost;
                if (t.ticket_support_agents) {
                    (t.ticket_support_agents as any[]).forEach(sa => {
                        totalKm += Math.max(0, (Number(sa.km_end) || 0) - (Number(sa.km_start) || 0));
                        const saCost = (Number(sa.compensation_total) || 0) + (Number(sa.toll_cost) || 0) + (Number(sa.food_cost) || 0) + (Number(sa.other_costs) || 0);
                        totalCost += saCost;
                        ticketCost += saCost;
                    });
                }

                if (t.city) {
                    const rk = `${t.city}-${t.state}`;
                    if (!regionMap[rk]) regionMap[rk] = { city: t.city, state: t.state || '', count: 0 };
                    regionMap[rk].count += 1;
                }

                const svcLabel = serviceTypeLabels[t.service_type] || t.service_type;
                serviceMap[svcLabel] = (serviceMap[svcLabel] || 0) + 1;
                if (!serviceRevMap[svcLabel]) serviceRevMap[svcLabel] = { revenue: 0, cost: 0 };
                serviceRevMap[svcLabel].revenue += rev;
                serviceRevMap[svcLabel].cost += ticketCost;

                try {
                    const mk = format(parseISO(t.start_datetime || t.created_at), 'MMM/yy', { locale: ptBR });
                    if (!monthlyMap[mk]) monthlyMap[mk] = { revenue: 0, cost: 0, count: 0 };
                    monthlyMap[mk].revenue += rev;
                    monthlyMap[mk].cost += ticketCost;
                    monthlyMap[mk].count += 1;
                } catch (_) {}
            });

            const allFinished = (tickets || []).filter(t => t.status === 'finalizado');
            const valorInadimplente = allFinished.filter(t => !t.revenue_status || t.revenue_status === 'pendente').reduce((s, t) => s + (Number(t.revenue_total) || 0), 0);
            const totalRevAll = allFinished.reduce((s, t) => s + (Number(t.revenue_total) || 0), 0);
            const receivedRev = allFinished.filter(t => t.revenue_status === 'recebido').reduce((s, t) => s + (Number(t.revenue_total) || 0), 0);
            const paidCosts = allFinished.reduce((s, t) => {
                let c = 0;
                if (t.main_agent_payment_status === 'pago') c += (Number(t.main_agent_compensation_total) || 0) + (Number(t.toll_cost) || 0) + (Number(t.food_cost) || 0) + (Number(t.other_costs) || 0);
                if (t.ticket_support_agents) (t.ticket_support_agents as any[]).forEach(sa => { if (sa.payment_status === 'pago') c += (Number(sa.compensation_total) || 0) + (Number(sa.toll_cost) || 0) + (Number(sa.food_cost) || 0) + (Number(sa.other_costs) || 0); });
                return s + c;
            }, 0);

            setAgentRanking(Object.entries(agentMap).map(([id, d]) => ({ id, name: d.name, count: d.count, avgTime: d.count > 0 ? Math.round(d.totalMinutes / d.count) : 0 })).sort((a, b) => b.count - a.count));

            const opMap: Record<string, { name: string; count: number }> = {};
            filtered.forEach((t: any) => {
                const opId = t.operator_id || 'system';
                const opName = t.operator?.name || opNameMap[t.operator_id] || 'Geral / Central';
                if (!opMap[opId]) opMap[opId] = { name: opName, count: 0 };
                opMap[opId].count += 1;
            });
            setOperatorRanking(Object.entries(opMap).map(([id, d]) => ({ id, name: d.name, count: d.count })).sort((a, b) => b.count - a.count));
            setRegionRanking(Object.values(regionMap).sort((a, b) => b.count - a.count).slice(0, 10));
            setServiceDistribution(Object.entries(serviceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
            setMonthlyData(Object.entries(monthlyMap).map(([month, d]) => ({ month, receita: Math.round(d.revenue), custo: Math.round(d.cost), lucro: Math.round(d.revenue - d.cost), chamados: d.count })));
            setServiceRevenueData(Object.entries(serviceRevMap).map(([name, d]) => ({ name, receita: Math.round(d.revenue), custo: Math.round(d.cost), margem: d.revenue > 0 ? Math.round(((d.revenue - d.cost) / d.revenue) * 100) : 0 })).sort((a, b) => b.receita - a.receita));

            const totalFinished = finishedTickets.length;
            const totalMinutes = finishedTickets.reduce((acc, t) => t.created_at && t.end_datetime ? acc + differenceInMinutes(parseISO(t.end_datetime), parseISO(t.created_at)) : acc, 0);
            const totalCancelled = filtered.filter(t => t.status === 'cancelado').length;
            setGlobalStats({ avgCompletionTime: totalFinished > 0 ? Math.round(totalMinutes / totalFinished) : 0, totalFinished, successRate: filtered.length > 0 ? Math.round((totalFinished / (totalFinished + totalCancelled || 1)) * 100) : 0, totalKm });

            const lucroBruto = totalRevenue - totalCost;
            const margemLucro = totalRevenue > 0 ? (lucroBruto / totalRevenue) * 100 : 0;
            const vr = totalRevenue > 0 ? totalCost / totalRevenue : 0;
            setFinancialStats({
                faturamentoBruto: totalRevenue, custoTotal: totalCost, lucroBruto, margemLucro,
                ticketMedio: totalFinished > 0 ? totalRevenue / totalFinished : 0,
                custoPorVenda: totalFinished > 0 ? totalCost / totalFinished : 0,
                pontoEquilibrio: vr > 0 && vr < 1 ? totalCost / (1 - vr) : totalCost,
                laborCostPct: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0,
                inadimplencia: totalRevAll > 0 ? (valorInadimplente / totalRevAll) * 100 : 0,
                valorInadimplente, saldoOperacional: receivedRev - paidCosts,
                totalChamados: totalFinished,
                prevFaturamento: prevRevenue, growthRevenue: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
                prevFinished: prevFinishedCount, growthTickets: prevFinishedCount > 0 ? ((totalFinished - prevFinishedCount) / prevFinishedCount) * 100 : 0,
            });
        } catch (err) {
            console.error('Erro ao buscar dados de performance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPerformanceData(); }, [range, date]);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl"><BarChart3 className="h-8 w-8 text-primary" /></div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Desempenho</h1>
                        <p className="text-muted-foreground mt-1">Métricas operacionais e financeiras consolidadas</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-card p-1 px-2 rounded-xl shadow-sm border">
                        <Select value={range} onValueChange={(v: FilterRange) => setRange(v)}>
                            <SelectTrigger className="w-[140px] border-none focus:ring-0 shadow-none bg-transparent h-8 p-0"><SelectValue placeholder="Período" /></SelectTrigger>
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
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[1,2,3].map(i => <Card key={i} className="animate-pulse border-none bg-muted/50 h-32" />)}</div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <Card key={i} className="animate-pulse border-none bg-muted/50 h-24" />)}</div>
                </div>
            ) : (
                <>
                    {/* ══ SEÇÃO 1 — INDICADORES FINANCEIROS (Admin) ══ */}
                    {isAdmin && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-emerald-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Indicadores Financeiros</h2>
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">Admin</Badge>
                            </div>

                            {/* Hero 3 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="border-none shadow-md bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
                                    <Layers className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium opacity-80 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Faturamento Bruto</span>
                                            <GrowthBadge pct={financialStats.growthRevenue} />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-black">{fmtCurrency(financialStats.faturamentoBruto)}</div>
                                        <p className="text-xs mt-1 opacity-60">{financialStats.totalChamados} chamados{financialStats.prevFaturamento > 0 && ` • ant: ${fmtCurrency(financialStats.prevFaturamento)}`}</p>
                                    </CardContent>
                                </Card>

                                <Card className={`border-none shadow-md overflow-hidden relative text-white ${financialStats.lucroBruto >= 0 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-red-600 to-red-700'}`}>
                                    <TrendingUp className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium opacity-80 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Lucro Bruto / Líquido</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-black">{fmtCurrency(financialStats.lucroBruto)}</div>
                                        <p className="text-xs mt-1 opacity-60">Mão de obra: {financialStats.laborCostPct.toFixed(1)}% da receita</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden relative">
                                    <Activity className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium opacity-80 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Margem de Lucro</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-black">{financialStats.margemLucro.toFixed(1)}%</div>
                                        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, financialStats.margemLucro))}%` }} />
                                        </div>
                                        <p className="text-xs mt-1.5 opacity-60">Ponto de equilíbrio: {fmtCurrency(financialStats.pontoEquilibrio)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Secondary 4 */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { icon: <Target className="h-3.5 w-3.5 text-violet-500" />, label: 'Ticket Médio', value: fmtCurrency(financialStats.ticketMedio), sub: 'Receita média por chamado', color: '' },
                                    { icon: <Users className="h-3.5 w-3.5 text-red-500" />, label: 'Custo por Venda', value: fmtCurrency(financialStats.custoPorVenda), sub: 'Custo médio por chamado', color: 'text-red-600' },
                                    {
                                        icon: <AlertTriangle className={`h-3.5 w-3.5 ${financialStats.inadimplencia > 30 ? 'text-red-500' : 'text-amber-500'}`} />,
                                        label: 'Taxa Inadimplência', value: `${financialStats.inadimplencia.toFixed(1)}%`,
                                        sub: `${fmtCurrency(financialStats.valorInadimplente)} a receber`,
                                        color: financialStats.inadimplencia > 30 ? 'text-red-600' : 'text-amber-600'
                                    },
                                    {
                                        icon: <Wallet className={`h-3.5 w-3.5 ${financialStats.saldoOperacional >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />,
                                        label: 'Saldo Operacional', value: fmtCurrency(financialStats.saldoOperacional),
                                        sub: 'Recebido − pagamentos realizados',
                                        color: financialStats.saldoOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'
                                    },
                                ].map((c, i) => (
                                    <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow bg-card">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">{c.icon}{c.label}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ SEÇÃO 2 — KPIs OPERACIONAIS ══ */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Métricas Operacionais</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { gradient: 'from-blue-600 to-blue-700', icon: <Timer className="h-7 w-7 opacity-10 absolute -right-2 -bottom-2" />, title: 'SLA Médio', value: fmtMin(globalStats.avgCompletionTime), sub: 'tempo de conclusão', badge: null },
                                { gradient: 'from-emerald-600 to-emerald-700', icon: <Award className="h-7 w-7 opacity-10 absolute -right-2 -bottom-2" />, title: 'Eficiência', value: `${globalStats.successRate}%`, sub: 'finalizados vs cancelados', badge: null },
                                { gradient: 'from-amber-500 to-orange-500', icon: <UserCheck className="h-7 w-7 opacity-10 absolute -right-2 -bottom-2" />, title: 'Agentes', value: String(agentRanking.length), sub: 'em campo no período', badge: null },
                                { gradient: 'from-indigo-600 to-indigo-700', icon: <Truck className="h-7 w-7 opacity-10 absolute -right-2 -bottom-2" />, title: 'Quilometragem', value: `${globalStats.totalKm.toLocaleString('pt-BR')} km`, sub: 'percorridos', badge: null },
                                { gradient: 'from-slate-600 to-slate-800', icon: <BarChart3 className="h-7 w-7 opacity-10 absolute -right-2 -bottom-2" />, title: 'Finalizados', value: String(globalStats.totalFinished), sub: 'chamados concluídos', badge: <GrowthBadge pct={financialStats.growthTickets} /> },
                            ].map((c, i) => (
                                <Card key={i} className={`border-none shadow-md bg-gradient-to-br ${c.gradient} text-white overflow-hidden relative`}>
                                    {c.icon}
                                    <CardHeader className="pb-1"><CardTitle className="text-xs font-medium opacity-80">{c.title}</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-black flex items-center gap-2">{c.value}{c.badge}</div>
                                        <p className="text-xs mt-1 opacity-60">{c.sub}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* ══ SEÇÃO 3 — EVOLUÇÃO FINANCEIRA (Admin) ══ */}
                    {isAdmin && monthlyData.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Evolução Financeira</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="shadow-xl border-none bg-card/50 overflow-hidden lg:col-span-2">
                                    <CardHeader className="bg-primary/5 border-b mb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Receita e Lucro por Período</CardTitle></CardHeader>
                                    <CardContent className="h-[280px] pt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={monthlyData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                                    <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: any, n: string) => [fmtCurrency(v), n === 'receita' ? 'Receita' : 'Lucro']} />
                                                <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} fill="url(#gRec)" />
                                                <Area type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2} fill="url(#gLuc)" />
                                                <Legend formatter={v => v === 'receita' ? 'Receita' : 'Lucro'} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-xl border-none bg-card/50 overflow-hidden">
                                    <CardHeader className="bg-primary/5 border-b mb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-500" /> Receita por Serviço</CardTitle></CardHeader>
                                    <CardContent className="h-[280px] pt-2">
                                        {serviceRevenueData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={serviceRevenueData} layout="vertical" margin={{ left: 5, right: 40, top: 5, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" hide />
                                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={90} />
                                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: any, n: string) => [n === 'receita' ? fmtCurrency(v) : `${v}%`, n === 'receita' ? 'Receita' : 'Margem']} />
                                                    <Bar dataKey="receita" radius={[0, 6, 6, 0]} barSize={16}>
                                                        {serviceRevenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex items-center justify-center h-full text-muted-foreground opacity-40 flex-col gap-2"><Building2 className="h-10 w-10" /><p className="text-sm">Sem dados</p></div>}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* ══ SEÇÃO 4 — RANKINGS ══ */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Rankings</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="shadow-xl border-none bg-card/50 overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b mb-4"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Ranking de Agentes</CardTitle></CardHeader>
                                <CardContent className="h-[360px] pt-2">
                                    {agentRanking.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={agentRanking} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} width={100} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                                                    {agentRanking.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50"><TrendingUp className="h-12 w-12 mb-2" /><p>Sem dados</p></div>}
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-none bg-card/50 overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b mb-4"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Produtividade de Operadores</CardTitle></CardHeader>
                                <CardContent className="h-[360px] pt-2">
                                    {operatorRanking.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={operatorRanking} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50"><Users className="h-12 w-12 mb-2" /><p>Sem dados</p></div>}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* ══ SEÇÃO 5 — GEO + SERVIÇOS ══ */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Geografia & Serviços</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="shadow-xl border-none bg-card/50 overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b mb-4"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-red-500" /> Top Regiões de Atuação</CardTitle></CardHeader>
                                <CardContent className="h-[360px] pt-4 overflow-auto">
                                    {regionRanking.length > 0 ? (
                                        <div className="space-y-3 pr-2">
                                            {regionRanking.map((r, i) => (
                                                <div key={i} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                                                        <div><p className="text-sm font-bold leading-none">{r.city}</p><p className="text-[10px] text-muted-foreground uppercase">{r.state}</p></div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right"><p className="text-sm font-black text-primary">{r.count}</p><p className="text-[9px] text-muted-foreground uppercase font-bold">Chamados</p></div>
                                                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden xl:block"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${(r.count / regionRanking[0].count) * 100}%` }} /></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50"><MapPin className="h-12 w-12 mb-2" /><p>Sem dados</p></div>}
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-none bg-card/50 overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b mb-4"><CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-indigo-500" /> Diversidade de Serviços</CardTitle></CardHeader>
                                <CardContent className="h-[360px] pt-4">
                                    {serviceDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={serviceDistribution} cx="50%" cy="45%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value">
                                                    {serviceDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50"><TrendingUp className="h-12 w-12 mb-2" /><p>Sem dados</p></div>}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* ══ SEÇÃO 6 — TABELA DETALHADA ══ */}
                    <Card className="shadow-xl border-none overflow-hidden">
                        <CardHeader className="bg-muted/50 border-b"><CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /> Ranking Detalhado de Agentes</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="border-b bg-muted/30"><th className="p-4 font-bold text-sm">Pos.</th><th className="p-4 font-bold text-sm">Agente</th><th className="p-4 font-bold text-sm text-center">Chamados</th><th className="p-4 font-bold text-sm text-right">Tempo Médio</th></tr></thead>
                                    <tbody className="divide-y">
                                        {agentRanking.map((a, i) => (
                                            <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="p-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-100 text-amber-600 border-2 border-amber-300' : i === 1 ? 'bg-slate-100 text-slate-600 border-2 border-slate-300' : i === 2 ? 'bg-orange-50 text-orange-600 border-2 border-orange-200' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div></td>
                                                <td className="p-4 font-semibold">{a.name}</td>
                                                <td className="p-4 text-center"><span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">{a.count}</span></td>
                                                <td className="p-4 text-right"><div className="flex items-center justify-end gap-2 text-sm text-muted-foreground"><Clock className="h-3 w-3" />{fmtMin(a.avgTime)}</div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};

export default Performance;
