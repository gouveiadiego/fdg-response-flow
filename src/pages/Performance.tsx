import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
    Users, UserCheck, Clock, TrendingUp, Calendar,
    BarChart3, Award, Zap, Timer
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { format, subDays, startOfMonth, startOfYear, isWithinInterval, differenceInMinutes, parseISO } from 'date-fns';
import { DatePickerWithRange } from '@/components/dashboard/DateRangePicker';
import { DateRange } from "react-day-picker";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface AgentPerformance {
    id: string;
    name: string;
    count: number;
    avgTime: number;
}

interface OperatorPerformance {
    id: string;
    name: string;
    count: number;
}

type FilterRange = '7days' | 'month' | 'year' | 'all' | 'custom';

const Performance = () => {
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<FilterRange>('month');
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });

    const [agentRanking, setAgentRanking] = useState<AgentPerformance[]>([]);
    const [operatorRanking, setOperatorRanking] = useState<OperatorPerformance[]>([]);
    const [globalStats, setGlobalStats] = useState({
        avgCompletionTime: 0,
        totalFinished: 0,
        successRate: 0,
    });

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    const fetchPerformanceData = async () => {
        setLoading(true);
        try {
            // Fetch tickets with agent and profile (for operator) relations
            const { data: tickets, error: ticketsError } = await supabase
                .from('tickets')
                .select(`
          *,
          main_agent:agents!tickets_main_agent_id_fkey(name),
          operator:operators(name)
        `);

            // Also fetch operators separately to ensure we can map even if join fails or for fallbacks
            const { data: allOperators } = await (supabase.from('operators' as any) as any).select('id, name');
            const opNameMap = Object.fromEntries(((allOperators as any[]) || []).map(o => [o.id, o.name]));

            if (ticketsError) throw ticketsError;

            // Filter by range
            const now = new Date();
            let filteredTickets = tickets || [];

            if (range === 'custom' && date?.from) {
                filteredTickets = (tickets || []).filter(t => {
                    const ticketDate = new Date(t.created_at);
                    return isWithinInterval(ticketDate, {
                        start: date.from!,
                        end: date.to || now
                    });
                });
            } else if (range !== 'all') {
                const start = range === '7days' ? subDays(now, 7) :
                    range === 'month' ? startOfMonth(now) :
                        startOfYear(now);

                filteredTickets = (tickets || []).filter(t => {
                    const ticketDate = new Date(t.created_at);
                    return isWithinInterval(ticketDate, { start, end: now });
                });
            }

            // 1. Process Agent Ranking (Finished Tickets only)
            const finishedTickets = filteredTickets.filter(t => t.status === 'finalizado');
            const agentMap: Record<string, { name: string, count: number, totalMinutes: number }> = {};

            finishedTickets.forEach(t => {
                const agentId = t.main_agent_id;
                const agentName = (t.main_agent as any)?.name || 'Desconhecido';

                if (!agentMap[agentId]) {
                    agentMap[agentId] = { name: agentName, count: 0, totalMinutes: 0 };
                }

                agentMap[agentId].count += 1;

                if (t.created_at && t.end_datetime) {
                    const diff = differenceInMinutes(parseISO(t.end_datetime), parseISO(t.created_at));
                    if (diff > 0) agentMap[agentId].totalMinutes += diff;
                }
            });

            const processedAgents = Object.entries(agentMap).map(([id, data]) => ({
                id,
                name: data.name,
                count: data.count,
                avgTime: data.count > 0 ? Math.round(data.totalMinutes / data.count) : 0,
            })).sort((a, b) => b.count - a.count);

            setAgentRanking(processedAgents);

            // 2. Process Operator Ranking (All tickets in period)
            const operatorMap: Record<string, { name: string, count: number }> = {};
            filteredTickets.forEach((t: any) => {
                // Use operator_id if present, fallback to "Geral / Central"
                const opId = t.operator_id || 'system';
                const opName = t.operator?.name || opNameMap[t.operator_id] || 'Geral / Central';

                if (!operatorMap[opId]) {
                    operatorMap[opId] = { name: opName, count: 0 };
                }
                operatorMap[opId].count += 1;
            });

            setOperatorRanking(
                Object.entries(operatorMap)
                    .map(([id, data]) => ({ id, name: data.name, count: data.count }))
                    .sort((a, b) => b.count - a.count)
            );

            // 3. Global Stats
            const totalMinutes = finishedTickets.reduce((acc, t) => {
                if (t.created_at && t.end_datetime) {
                    return acc + differenceInMinutes(parseISO(t.end_datetime), parseISO(t.created_at));
                }
                return acc;
            }, 0);

            const totalFinished = finishedTickets.length;
            const totalCancelled = filteredTickets.filter(t => t.status === 'cancelado').length;
            const successRate = filteredTickets.length > 0
                ? Math.round((totalFinished / (totalFinished + totalCancelled || 1)) * 100)
                : 0;

            setGlobalStats({
                avgCompletionTime: totalFinished > 0 ? Math.round(totalMinutes / totalFinished) : 0,
                totalFinished,
                successRate,
            });

        } catch (error) {
            console.error('Erro ao buscar dados de performance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformanceData();
    }, [range, date]);

    const formatMinutes = (min: number) => {
        if (min < 60) return `${min}m`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}h ${m}m`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <BarChart3 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                            Desempenho da Equipe
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Métricas de produtividade e eficiência operacional
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-card p-1 px-2 rounded-xl shadow-sm border">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse border-none bg-muted/50 h-32" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-none shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative">
                            <Zap className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
                                    <Timer className="h-4 w-4" /> SLA Médio de Conclusão
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">{formatMinutes(globalStats.avgCompletionTime)}</div>
                                <p className="text-xs mt-1 opacity-70 italic">Calculado sobre {globalStats.totalFinished} chamados</p>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white overflow-hidden relative">
                            <Award className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" /> Taxa de Eficiência
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">{globalStats.successRate}%</div>
                                <p className="text-xs mt-1 opacity-70 italic">Finalizados vs Cancelados</p>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden relative">
                            <UserCheck className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10" />
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Agentes Ativos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">{agentRanking.length}</div>
                                <p className="text-xs mt-1 opacity-70 italic">Profissionais em campo no período</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b mb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Award className="h-5 w-5 text-primary" /> Ranking de Agentes (Top Chamados)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px] pt-4 min-h-[400px]">
                                {agentRanking.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={agentRanking}
                                            layout="vertical"
                                            margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                                            key={`agent-chart-${agentRanking.length}`}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                                width={100}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar
                                                dataKey="count"
                                                radius={[0, 8, 8, 0]}
                                                barSize={20}
                                                fill="#3b82f6"
                                            >
                                                {agentRanking.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                        <TrendingUp className="h-12 w-12 mb-2" />
                                        <p>Sem dados no período</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b mb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-amber-500" /> Produtividade de Operadores
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px] pt-4 min-h-[400px]">
                                {operatorRanking.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={operatorRanking}
                                            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                            key={`op-chart-${operatorRanking.length}`}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                        <Users className="h-12 w-12 mb-2" />
                                        <p>Sem dados no período</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-xl border-none overflow-hidden">
                        <CardHeader className="bg-muted/50 border-b">
                            <CardTitle className="text-lg">Tabela de Ranking Detalhado</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-muted lg:bg-transparent">
                                        <tr className="border-b">
                                            <th className="p-4 font-bold text-sm">Posição</th>
                                            <th className="p-4 font-bold text-sm">Agente</th>
                                            <th className="p-4 font-bold text-sm text-center">Chamados Concluídos</th>
                                            <th className="p-4 font-bold text-sm text-right">Tempo Médio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {agentRanking.map((agent, index) => (
                                            <tr key={agent.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="p-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-amber-100 text-amber-600 border-2 border-amber-300' :
                                                        index === 1 ? 'bg-slate-100 text-slate-600 border-2 border-slate-300' :
                                                            index === 2 ? 'bg-orange-50 text-orange-600 border-2 border-orange-200' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                        {index + 1}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-semibold">{agent.name}</td>
                                                <td className="p-4 text-center">
                                                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">
                                                        {agent.count}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                                        <Clock className="h-3 w-3" /> {formatMinutes(agent.avgTime)}
                                                    </div>
                                                </td>
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
