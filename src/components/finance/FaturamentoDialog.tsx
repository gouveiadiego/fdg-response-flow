import { useState, useEffect } from 'react';
// v3 - force build
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { parseSafeNumber } from '@/lib/numberUtils';
import { Button } from '@/components/ui/button';
import { Calculator, Info, Car, Clock, FileText, User, Link as LinkIcon, Copy } from 'lucide-react';
import { generateClientInvoicePDF } from './ClientInvoicePDFGenerator';

const optionalNumber = z.number().or(z.string().transform(v => v === '' ? undefined : Number(v))).optional();

const ALARME_PRICING = {
    base: 180,
    includedHours: 0.5,
    includedKm: 50,
    extraHourRate: 40,
    extraKmRate: 2.50,
};

const faturamentoSchema = z.object({
    revenue_base_value: optionalNumber,
    revenue_included_hours: optionalNumber,
    revenue_included_km: optionalNumber,
    revenue_extra_hour_rate: optionalNumber,
    revenue_extra_km_rate: optionalNumber,
    revenue_discount_addition: optionalNumber,
    revenue_total: optionalNumber,
});

type FaturamentoFormData = z.infer<typeof faturamentoSchema>;

interface FaturamentoDialogProps {
    ticketId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function FaturamentoDialog({ ticketId, open, onOpenChange, onSuccess }: FaturamentoDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isAlarmPlan, setIsAlarmPlan] = useState(false);
    const [planName, setPlanName] = useState<string | null>(null);
    const [contextInfo, setContextInfo] = useState<{ clientName: string; plate: string; code: string; city: string; state: string; coordinates_lat: number | null; coordinates_lng: number | null } | null>(null);
    const [agentBreakdown, setAgentBreakdown] = useState<{ 
        name: string; 
        role: string; 
        hours: number; 
        km: number;
        startTime: Date | null;
        endTime: Date | null;
        startKm: number;
        endKm: number;
    }[]>([]);

    // Real stats from the ticket to calculate over
    const [ticketStats, setTicketStats] = useState({
        durationHours: 0,
        totalKm: 0,
    });

    const form = useForm<FaturamentoFormData>({
        resolver: zodResolver(faturamentoSchema),
        defaultValues: {
            revenue_base_value: 0,
            revenue_included_hours: 3,
            revenue_included_km: 50,
            revenue_extra_hour_rate: 90,
            revenue_extra_km_rate: 2.50,
            revenue_discount_addition: 0,
            revenue_total: 0,
        },
    });

    useEffect(() => {
        if (open && ticketId) {
            fetchTicketData();
        }
    }, [open, ticketId]);

    const fetchTicketData = async () => {
        setIsFetching(true);
        try {
            const { data: ticket, error } = await supabase
                .from('tickets')
                .select(`
                  id, code, km_start, km_end, service_type,
                  main_agent_arrival, main_agent_departure,
                  revenue_base_value, revenue_included_hours, revenue_included_km,
                  revenue_extra_hour_rate, revenue_extra_km_rate, revenue_discount_addition,
                  revenue_total,
                  city, state, coordinates_lat, coordinates_lng,
                  main_agent:agents!tickets_main_agent_id_fkey ( name ),
                  plans ( name ),
                  clients ( name ),
                  vehicles ( tractor_plate ),
                  ticket_support_agents (
                    arrival, departure, km_start, km_end,
                    agent:agents ( name )
                  )
                `)
                .eq('id', ticketId)
                .single();

            if (error) throw error;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ticketPlanName = (ticket as any).plans?.name ?? null;
            setPlanName(ticketPlanName);
            const isAlarme = ticket.service_type === 'alarme' || (ticketPlanName?.toLowerCase().includes('alarme') ?? false);
            setIsAlarmPlan(isAlarme);

            setContextInfo({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clientName: (ticket as any).clients?.name || 'Não informado',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                plate: (ticket as any).vehicles?.tractor_plate || 'Sem placa',
                code: ticket.code || '-',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                city: (ticket as any).city || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                state: (ticket as any).state || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                coordinates_lat: (ticket as any).coordinates_lat ?? null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                coordinates_lng: (ticket as any).coordinates_lng ?? null,
            });

            // Calculate total duration and breakdown
            let totalDiffMs = 0;
            const breakdown: { 
                name: string; 
                role: string; 
                hours: number; 
                km: number;
                startTime: Date | null;
                endTime: Date | null;
                startKm: number;
                endKm: number;
            }[] = [];

            // Main Agent
            const m_arrival = ticket.main_agent_arrival;
            const m_departure = ticket.main_agent_departure;
            const m_startKm = Number(ticket.km_start) || 0;
            const m_endKm = Number(ticket.km_end) || 0;
            const m_diff = m_arrival && m_departure ? new Date(m_departure).getTime() - new Date(m_arrival).getTime() : 0;
            const m_km = Math.max(0, m_endKm - m_startKm);

            totalDiffMs += m_diff > 0 ? m_diff : 0;
            breakdown.push({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                name: (ticket as any).main_agent?.name || 'Agente Principal',
                role: 'Principal',
                hours: m_diff > 0 ? m_diff / (1000 * 60 * 60) : 0,
                km: m_km,
                startTime: m_arrival ? new Date(m_arrival) : null,
                endTime: m_departure ? new Date(m_departure) : null,
                startKm: m_startKm,
                endKm: m_endKm
            });

            // Support Agents
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ticket.ticket_support_agents?.forEach((sa: any, idx: number) => {
                const s_arrival = sa.arrival;
                const s_departure = sa.departure;
                const s_startKm = Number(sa.km_start) || 0;
                const s_endKm = Number(sa.km_end) || 0;
                const s_diff = s_arrival && s_departure ? new Date(s_departure).getTime() - new Date(s_arrival).getTime() : 0;
                const s_km = Math.max(0, s_endKm - s_startKm);

                totalDiffMs += s_diff > 0 ? s_diff : 0;
                breakdown.push({
                    name: sa.agent?.name || `Apoio ${idx + 1}`,
                    role: `Apoio ${idx + 1}`,
                    hours: s_diff > 0 ? s_diff / (1000 * 60 * 60) : 0,
                    km: s_km,
                    startTime: s_arrival ? new Date(s_arrival) : null,
                    endTime: s_departure ? new Date(s_departure) : null,
                    startKm: s_startKm,
                    endKm: s_endKm
                });
            });

            const durationHours = totalDiffMs > 0 ? totalDiffMs / (1000 * 60 * 60) : 0;
            const totalKmList = breakdown.reduce((sum, item) => sum + item.km, 0);

            setAgentBreakdown(breakdown);
            setTicketStats({ durationHours, totalKm: totalKmList });

            const useAlarmDefaults = isAlarme;
            const savedBaseValue = Number(ticket.revenue_base_value);
            const savedIncludedHours = Number(ticket.revenue_included_hours);
            const savedExtraHourRate = Number(ticket.revenue_extra_hour_rate);

            form.reset({
                revenue_base_value: useAlarmDefaults ? ((ticket.revenue_base_value != null && savedBaseValue !== 500) ? savedBaseValue : ALARME_PRICING.base) : (ticket.revenue_base_value ?? 500),
                revenue_included_hours: useAlarmDefaults ? ((ticket.revenue_included_hours != null && savedIncludedHours !== 3) ? savedIncludedHours : ALARME_PRICING.includedHours) : (ticket.revenue_included_hours ?? 3),
                revenue_included_km: ticket.revenue_included_km ?? (isAlarme ? ALARME_PRICING.includedKm : 50),
                revenue_extra_hour_rate: useAlarmDefaults ? ((ticket.revenue_extra_hour_rate != null && savedExtraHourRate !== 90) ? savedExtraHourRate : ALARME_PRICING.extraHourRate) : (ticket.revenue_extra_hour_rate ?? 90),
                revenue_extra_km_rate: ticket.revenue_extra_km_rate ?? (isAlarme ? ALARME_PRICING.extraKmRate : 2.5),
                revenue_discount_addition: ticket.revenue_discount_addition ?? 0,
                revenue_total: ticket.revenue_total ?? 0,
            });

        } catch (error) {
            console.error('Erro ao buscar dados do ticket:', error);
            toast.error('Erro ao buscar dados do chamado.');
        } finally {
            setIsFetching(false);
        }
    };

    const baseValue = form.watch('revenue_base_value') || 0;
    const includedHours = form.watch('revenue_included_hours') || 0;
    const includedKm = form.watch('revenue_included_km') || 0;
    const extraHourRate = form.watch('revenue_extra_hour_rate') || 0;
    const extraKmRate = form.watch('revenue_extra_km_rate') || 0;
    const discountAddition = form.watch('revenue_discount_addition') || 0;

    const extraKm = Math.max(0, ticketStats.totalKm - includedKm);
    const costExtraKm = extraKm * extraKmRate;
    const extraHours = Math.max(0, ticketStats.durationHours - includedHours);
    const costExtraHours = extraHours * extraHourRate;
    const calculatedTotal = baseValue + costExtraHours + costExtraKm + discountAddition;

    const handleGeneratePDF = async () => {
        if (!contextInfo) return;

        await generateClientInvoicePDF({
            ticketCode: contextInfo.code,
            clientName: contextInfo.clientName,
            serviceType: isAlarmPlan ? 'ALARME' : 'ATENDIMENTO',
            planName: planName || 'N/A',
            vehiclePlate: contextInfo.plate,
            city: contextInfo.city,
            state: contextInfo.state,
            coordinates_lat: contextInfo.coordinates_lat,
            coordinates_lng: contextInfo.coordinates_lng,
            durationHours: ticketStats.durationHours,
            totalKm: ticketStats.totalKm,
            baseValue,
            includedHours,
            includedKm,
            extraHourRate,
            extraKmRate,
            extraHours,
            extraKm,
            discountAddition,
            total: calculatedTotal,
            agentBreakdown: agentBreakdown
        });
    };

    const onSubmit = async (data: FaturamentoFormData) => {
        setIsLoading(true);
        try {
            const v_base = parseSafeNumber(data.revenue_base_value);
            const v_inc_h = parseSafeNumber(data.revenue_included_hours);
            const v_inc_km = parseSafeNumber(data.revenue_included_km);
            const v_extra_h_rate = parseSafeNumber(data.revenue_extra_hour_rate);
            const v_extra_km_rate = parseSafeNumber(data.revenue_extra_km_rate);
            const v_adjust = parseSafeNumber(data.revenue_discount_addition);

            const ex_h = Math.max(0, ticketStats.durationHours - v_inc_h);
            const ex_km = Math.max(0, ticketStats.totalKm - v_inc_km);
            const finalTotal = v_base + (ex_h * v_extra_h_rate) + (ex_km * v_extra_km_rate) + v_adjust;

            const { error } = await supabase.from('tickets').update({
                revenue_base_value: v_base,
                revenue_included_hours: v_inc_h,
                revenue_included_km: v_inc_km,
                revenue_extra_hour_rate: v_extra_h_rate,
                revenue_extra_km_rate: v_extra_km_rate,
                revenue_discount_addition: v_adjust,
                revenue_total: finalTotal,
            }).eq('id', ticketId);

            if (error) throw error;

            toast.success('Faturamento salvo com sucesso!');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDuration = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        const s = Math.floor(((hours - h) * 60 - m) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const renderProgressBar = (consumed: number, included: number, isKm: boolean) => {
        const extra = Math.max(0, consumed - included);
        const maxVal = Math.max(consumed, included) || 1;
        
        if (extra <= 0) {
            const pctConsumed = Math.min((consumed / maxVal) * 100, 100);
            return (
                <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                        <span className="text-zinc-500">Consumo Franquia</span>
                        <span className="text-zinc-400">{pctConsumed.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                            className="h-full bg-emerald-500/80 transition-all duration-500" 
                            style={{ width: `${pctConsumed}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] px-1 pt-0.5">
                        <span className="text-zinc-500">Franquia: {included}{isKm ? 'KM' : 'h'}</span>
                        <span className="text-zinc-500">Restante: {(included - consumed).toFixed(isKm ? 0 : 1)}{isKm ? 'KM' : 'h'}</span>
                    </div>
                </div>
            );
        }
        
        const pctFranchise = (included / maxVal) * 100;
        const pctExtra = (extra / maxVal) * 100;
        
        return (
            <div className="space-y-1.5 mt-2">
                <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                    <span className="text-zinc-500">Franquia Excedida</span>
                    <span className="text-orange-400">Excedente ({extra.toFixed(isKm ? 0 : 1)}{isKm ? ' KM' : 'h'})</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex relative shadow-inner">
                    <div 
                        className="h-full bg-zinc-600 transition-all duration-500" 
                        style={{ width: `${pctFranchise}%` }}
                    />
                    <div 
                        className="h-full bg-orange-500 transition-all duration-500" 
                        style={{ width: `${pctExtra}%` }}
                    />
                    <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-zinc-950" 
                        style={{ left: `${pctFranchise}%` }}
                    />
                </div>
                <div className="flex justify-between text-[11px] px-1 pt-0.5">
                    <span className="text-zinc-500">Franquia: {included}{isKm ? 'KM' : 'h'}</span>
                    <span className="text-orange-400 font-bold">Total: {consumed.toFixed(isKm ? 0 : 1)}{isKm ? 'KM' : 'h'}</span>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 border-none bg-zinc-950 text-zinc-100">
                <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border-b border-zinc-800/50">
                    <DialogHeader>
                        <div className="flex items-center justify-between mb-2">
                            <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                <Calculator className="w-6 h-6 text-primary" />
                                Faturamento Cliente (VERSÃO ATUALIZADA)
                            </DialogTitle>
                            <div className="flex gap-2">
                                {isAlarmPlan && (
                                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        🔔 ALARME
                                    </span>
                                )}
                                <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-1 rounded-full text-xs font-medium">
                                    {planName || 'Plano não definido'}
                                </span>
                            </div>
                        </div>
                        <DialogDescription className="text-zinc-400">
                            Conferência e definição de valores para cobrança do cliente <strong>{contextInfo?.clientName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {isFetching ? (
                    <div className="p-20 text-center text-zinc-500 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Carregando dados de faturamento...
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                                {/* Left Side: Details & Stats */}
                                <div className="lg:col-span-7 p-6 space-y-8 bg-zinc-900/30">
                                    <section>
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Info className="w-3.5 h-3.5" />
                                            Operação | Contexto
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Chamado</p>
                                                <p className="text-sm font-semibold text-zinc-200">{contextInfo?.code}</p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 text-ellipsis overflow-hidden">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Cliente</p>
                                                <p className="text-sm font-semibold text-zinc-200 uppercase truncate text-nowrap">{contextInfo?.clientName}</p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 col-span-2 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Placa do Veículo</p>
                                                    <p className="text-sm font-semibold text-zinc-200">{contextInfo?.plate || 'Não informada'}</p>
                                                </div>
                                                <Car className="w-4 h-4 text-zinc-400" />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-6">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            Detalhamento da Execução
                                        </h3>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <p className="text-sm font-medium text-zinc-300">Tempo de Atendimento</p>
                                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/50 text-center relative overflow-hidden group">
                                                    <p className="text-2xl font-black text-white relative z-10">{formatDuration(ticketStats.durationHours)}</p>
                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase relative z-10">Total Horas</p>
                                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                {renderProgressBar(ticketStats.durationHours, includedHours, false)}
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-sm font-medium text-zinc-300">Distância Total</p>
                                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/50 text-center relative overflow-hidden group">
                                                    <p className="text-2xl font-black text-white relative z-10">{ticketStats.totalKm.toFixed(0)} KM</p>
                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase relative z-10">Percorrido</p>
                                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                {renderProgressBar(ticketStats.totalKm, includedKm, true)}
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 border-dashed">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Info className="w-4 h-4 text-primary" />
                                                <p className="text-xs font-bold text-zinc-300 uppercase">Detalhamento por Agente</p>
                                            </div>
                                            <div className="space-y-3">
                                                {agentBreakdown.map((agent, i) => (
                                                    <div key={i} className="flex flex-col gap-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/30">
                                                        <div className="flex justify-between items-center border-b border-zinc-800/30 pb-2">
                                                            <span className="text-[11px] font-bold text-zinc-200 uppercase flex items-center gap-1.5">
                                                                <User className="w-3.5 h-3.5 text-primary" />
                                                                {agent.name}
                                                                <span className="text-[9px] text-zinc-500 font-normal">({agent.role})</span>
                                                            </span>
                                                            {(() => {
                                                                const agentExtraKm = ticketStats.totalKm > 0 ? (agent.km / ticketStats.totalKm) * extraKm : 0;
                                                                const agentExtraHours = ticketStats.durationHours > 0 ? (agent.hours / ticketStats.durationHours) * extraHours : 0;
                                                                const agentTotalCost = (agentExtraKm * extraKmRate) + (agentExtraHours * extraHourRate);
                                                                
                                                                if (agentTotalCost > 0) {
                                                                    return (
                                                                        <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                                                            Custo: {agentTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase font-bold">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    Período
                                                                </div>
                                                                <div className="text-[10px] text-zinc-300 space-y-0.5">
                                                                    <p>Início: {agent.startTime ? format(agent.startTime, "HH:mm:ss") : "--:--:--"}</p>
                                                                    <p>Fim: {agent.endTime ? format(agent.endTime, "HH:mm:ss") : "--:--:--"}</p>
                                                                    <p className="text-primary font-bold mt-1">Total: {formatDuration(agent.hours)}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5 border-l border-zinc-800/30 pl-4">
                                                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase font-bold">
                                                                    <Car className="w-2.5 h-2.5" />
                                                                    Quilometragem
                                                                </div>
                                                                <div className="text-[10px] text-zinc-300 space-y-0.5">
                                                                    <p>Início: {agent.startKm.toFixed(0)} KM</p>
                                                                    <p>Fim: {agent.endKm.toFixed(0)} KM</p>
                                                                    <p className="text-primary font-bold mt-1">Total: {agent.km.toFixed(0)} KM</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50 border-dashed">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Info className="w-4 h-4 text-primary" />
                                                <p className="text-xs font-bold text-zinc-300 uppercase">Simulação de Custos Extras</p>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-zinc-400">Total KM Extra ({extraKm.toFixed(0)}):</span>
                                                    <span className="text-zinc-300">{costExtraKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-zinc-400">Total Horas Extra ({extraHours.toFixed(1)}h):</span>
                                                    <span className="text-zinc-300">{costExtraHours.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Right Side: Parameters & Total */}
                                <div className="lg:col-span-5 p-6 space-y-6 border-l border-zinc-800/50 bg-zinc-950">
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                        <Calculator className="w-3.5 h-3.5" />
                                        Valores do Faturamento
                                    </h3>

                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="revenue_base_value"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Valor Base (R$)</FormLabel>
                                                    <FormControl>
                                                        <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono text-lg" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="revenue_included_hours"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">Franquia Horas</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="revenue_included_km"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">Franquia KM</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="revenue_extra_hour_rate"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">R$ Hora Extra</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="revenue_extra_km_rate"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">R$ KM Extra</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="revenue_discount_addition"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Ajustes / Acréscimos (R$)</FormLabel>
                                                    <FormControl>
                                                        <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-4 pt-4 mt-auto">
                                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 shadow-xl overflow-hidden relative">
                                            <div className="flex justify-between items-center relative z-10">
                                                <div>
                                                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">TOTAL A COBRAR</p>
                                                    <p className="text-3xl font-black text-white leading-tight">
                                                        {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                                <div className="bg-primary/10 p-3 rounded-full">
                                                    <Calculator className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -mr-16 -mt-16" />
                                        </div>

                                        <div className="flex flex-col gap-2 pt-2">
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleGeneratePDF}
                                                    disabled={isFetching || isLoading}
                                                    className="flex-1 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300 gap-2 font-bold"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    FATURA PDF
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => onOpenChange(false)}
                                                    className="flex-1 bg-transparent border-zinc-800 hover:bg-zinc-900 text-zinc-500"
                                                >
                                                    CANCELAR
                                                </Button>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/acompanhamento/${ticketId}`);
                                                    toast.success('Link de acompanhamento copiado!');
                                                }}
                                                className="w-full bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-primary gap-2 font-bold mb-1"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                                COPIAR LINK DE ACOMPANHAMENTO
                                            </Button>
                                            <Button 
                                                type="submit" 
                                                disabled={isLoading} 
                                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black tracking-widest uppercase shadow-[0_0_20px_rgba(var(--primary),0.3)] h-12"
                                            >
                                                {isLoading ? 'SALVANDO...' : 'SALVAR FATURAMENTO'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
