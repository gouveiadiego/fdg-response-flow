import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseSafeNumber } from '@/lib/numberUtils';
import { Clock, MapPin, Calculator, Info, User, Car } from 'lucide-react';

const optionalNumber = z.number().or(z.string().transform(v => v === '' ? undefined : Number(v))).optional();

const ALARME_PRICING = {
    base: 100,
    includedHours: 0.5,
    includedKm: 50,
    extraHourRate: 20,
    extraKmRate: 1.50,
};

// Pricing per agent role based on armed/unarmed
const ARMED_PRICING = { base: 300, includedHours: 3, includedKm: 50, extraHourRate: 45, extraKmRate: 1.50 };
const UNARMED_PRICING = { base: 280, includedHours: 3, includedKm: 50, extraHourRate: 40, extraKmRate: 1.50 };

/**
 * Determine if the agent acting in a given role should be priced as ARMED or UNARMED,
 * based on the plan name and their role (principal or support).
 */
function getIsArmedByPlan(
    planName: string | null | undefined,
    agentRole: 'principal' | 'apoio_1' | 'apoio_2',
    agentIsArmed: boolean
): boolean {
    if (!planName) return agentIsArmed;
    const name = planName.toLowerCase();
    const isSupport = agentRole !== 'principal';

    if (name.includes('armado + 1 desarmado') || name.includes('armado+1 desarmado')) {
        return !isSupport; // principal=armed, support=unarmed
    }
    if (name.includes('2 agente') && name.includes('armado')) return true;  // 2 armed
    if (name.includes('1 agente') && name.includes('armado') && !name.includes('desarmado')) return true;
    if (name.includes('1 agente') && name.includes('desarmado') && !name.includes('armado + ')) return false;
    return agentIsArmed; // fallback
}

const compensationSchema = z.object({
    compensation_base_value: optionalNumber,
    compensation_included_hours: optionalNumber,
    compensation_included_km: optionalNumber,
    compensation_extra_hour_rate: optionalNumber,
    compensation_extra_km_rate: optionalNumber,
    compensation_total: optionalNumber,
    toll_cost: optionalNumber,
    food_cost: optionalNumber,
    other_costs: optionalNumber,
});

type CompensationFormData = z.infer<typeof compensationSchema>;

interface PagamentoAgenteDialogProps {
    ticketId: string | null;
    agentId: string | null;
    agentRole: 'principal' | 'apoio_1' | 'apoio_2';
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function PagamentoAgenteDialog({ ticketId, agentId, agentRole, open, onOpenChange, onSuccess }: PagamentoAgenteDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [agentInfo, setAgentInfo] = useState<{ name: string; isArmed: boolean } | null>(null);
    const [contextInfo, setContextInfo] = useState<{ clientName: string; plate: string; code: string } | null>(null);
    const [isAlarmPlan, setIsAlarmPlan] = useState(false);
    const [planName, setPlanName] = useState<string | null>(null);

    // Detailed stats for the breakdown UI
    const [detailedStats, setDetailedStats] = useState({
        startTime: null as Date | null,
        endTime: null as Date | null,
        startKm: 0,
        endKm: 0,
        totalKm: 0,
        durationHours: 0,
    });

    const form = useForm<CompensationFormData>({
        resolver: zodResolver(compensationSchema),
        defaultValues: {
            compensation_base_value: 0,
            compensation_included_hours: 3,
            compensation_included_km: 50,
            compensation_extra_hour_rate: 0,
            compensation_extra_km_rate: 1.50,
            compensation_total: 0,
            toll_cost: 0,
            food_cost: 0,
            other_costs: 0,
        },
    });

    useEffect(() => {
        if (open && ticketId && agentId) {
            fetchData();
        }
    }, [open, ticketId, agentId]);

    const fetchData = async () => {
        setIsFetching(true);
        try {
            const { data: agent, error: agentError } = await supabase
                .from('agents')
                .select('name, is_armed')
                .eq('id', agentId)
                .single();

            if (agentError) throw agentError;
            setAgentInfo({ name: agent.name, isArmed: !!agent.is_armed });

            const { data: ticket, error } = await supabase
                .from('tickets')
                .select('*, plans(name), clients(name), vehicles(tractor_plate)')
                .eq('id', ticketId)
                .single();

            if (error) throw error;

            const ticketPlanName = (ticket as any).plans?.name ?? null;
            setPlanName(ticketPlanName);
            setContextInfo({
                clientName: (ticket as any).clients?.name || 'Não informado',
                plate: (ticket as any).vehicles?.tractor_plate || 'Sem placa',
                code: ticket.code || '-'
            });

            const isAlarme = ticketPlanName?.toLowerCase().includes('alarme') ?? false;
            setIsAlarmPlan(isAlarme);

            let startTime = null;
            let endTime = null;
            let startKm = 0;
            let endKm = 0;
            let existingValues: any = {};

            if (agentRole === 'principal') {
                startTime = ticket.main_agent_arrival ? new Date(ticket.main_agent_arrival) : null;
                endTime = ticket.main_agent_departure ? new Date(ticket.main_agent_departure) : null;
                startKm = Number(ticket.km_start) || 0;
                endKm = Number(ticket.km_end) || 0;

                existingValues = {
                    base: ticket.main_agent_compensation_base_value,
                    incHours: ticket.main_agent_compensation_included_hours,
                    incKm: ticket.main_agent_compensation_included_km,
                    extraRate: ticket.main_agent_compensation_extra_hour_rate,
                    extraKmRate: ticket.main_agent_compensation_extra_km_rate,
                    total: ticket.main_agent_compensation_total,
                    toll: ticket.toll_cost,
                    food: ticket.food_cost,
                    other: ticket.other_costs
                };
            } else {
                const { data: supportAgent, error: supportError } = await supabase
                    .from('ticket_support_agents')
                    .select('*')
                    .eq('ticket_id', ticketId)
                    .eq('agent_id', agentId)
                    .maybeSingle();

                if (supportError) throw supportError;
                if (!supportAgent) throw new Error('Agente de apoio não encontrado.');

                startTime = supportAgent.arrival ? new Date(supportAgent.arrival) : null;
                endTime = supportAgent.departure ? new Date(supportAgent.departure) : null;
                startKm = Number(supportAgent.km_start) || 0;
                endKm = Number(supportAgent.km_end) || 0;

                existingValues = {
                    base: supportAgent.compensation_base_value,
                    incHours: supportAgent.compensation_included_hours,
                    incKm: supportAgent.compensation_included_km,
                    extraRate: supportAgent.compensation_extra_hour_rate,
                    extraKmRate: supportAgent.compensation_extra_km_rate,
                    total: supportAgent.compensation_total,
                    toll: supportAgent.toll_cost,
                    food: supportAgent.food_cost,
                    other: supportAgent.other_costs
                };
            }

            const totalKm = Math.max(0, endKm - startKm);
            const durationHours = startTime && endTime ? (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) : 0;

            setDetailedStats({ startTime, endTime, startKm, endKm, totalKm, durationHours });

            const agentIsArmedByPlan = getIsArmedByPlan(ticketPlanName, agentRole, !!agent.is_armed);
            const pricing = agentIsArmedByPlan ? ARMED_PRICING : UNARMED_PRICING;

            form.reset({
                compensation_base_value: existingValues.base ?? (isAlarme ? ALARME_PRICING.base : pricing.base),
                compensation_included_hours: existingValues.incHours ?? (isAlarme ? ALARME_PRICING.includedHours : pricing.includedHours),
                compensation_included_km: existingValues.incKm ?? (isAlarme ? ALARME_PRICING.includedKm : pricing.includedKm),
                compensation_extra_hour_rate: existingValues.extraRate ?? (isAlarme ? ALARME_PRICING.extraHourRate : pricing.extraHourRate),
                compensation_extra_km_rate: existingValues.extraKmRate ?? (isAlarme ? ALARME_PRICING.extraKmRate : pricing.extraKmRate),
                compensation_total: existingValues.total ?? 0,
                toll_cost: existingValues.toll ?? 0,
                food_cost: existingValues.food ?? 0,
                other_costs: existingValues.other ?? 0,
            });

        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            toast.error('Erro ao buscar dados do agente.');
        } finally {
            setIsFetching(false);
        }
    };

    const formatDuration = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        const s = Math.floor(((hours - h) * 60 - m) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Watchers for real-time update
    const baseValue = form.watch('compensation_base_value') || 0;
    const includedHours = form.watch('compensation_included_hours') || 0;
    const includedKm = form.watch('compensation_included_km') || 0;
    const extraHourRate = form.watch('compensation_extra_hour_rate') || 0;
    const extraKmRate = form.watch('compensation_extra_km_rate') || 0;
    const tollCost = form.watch('toll_cost') || 0;
    const foodCost = form.watch('food_cost') || 0;
    const otherCosts = form.watch('other_costs') || 0;

    const extraKm = Math.max(0, detailedStats.totalKm - includedKm);
    const extraHours = Math.max(0, detailedStats.durationHours - includedHours);

    const costExtraKm = extraKm * extraKmRate;
    const costExtraHours = extraHours * extraHourRate;
    const baseHonorario = baseValue + costExtraHours + costExtraKm;
    const calculatedTotal = baseHonorario + tollCost + foodCost + otherCosts;

    const onSubmit = async (data: CompensationFormData) => {
        setIsLoading(true);
        try {
            const val_base = parseSafeNumber(data.compensation_base_value);
            const val_inc_h = parseSafeNumber(data.compensation_included_hours);
            const val_inc_km = parseSafeNumber(data.compensation_included_km);
            const val_extra_h_rate = parseSafeNumber(data.compensation_extra_hour_rate);
            const val_extra_km_rate = parseSafeNumber(data.compensation_extra_km_rate);
            const val_toll = parseSafeNumber(data.toll_cost);
            const val_food = parseSafeNumber(data.food_cost);
            const val_other = parseSafeNumber(data.other_costs);

            const ex_h = Math.max(0, detailedStats.durationHours - val_inc_h);
            const ex_km = Math.max(0, detailedStats.totalKm - val_inc_km);
            const totalHon = val_base + (ex_h * val_extra_h_rate) + (ex_km * val_extra_km_rate);

            if (agentRole === 'principal') {
                const { error } = await supabase.from('tickets').update({
                    main_agent_compensation_base_value: val_base,
                    main_agent_compensation_included_hours: val_inc_h,
                    main_agent_compensation_included_km: val_inc_km,
                    main_agent_compensation_extra_hour_rate: val_extra_h_rate,
                    main_agent_compensation_extra_km_rate: val_extra_km_rate,
                    main_agent_compensation_total: totalHon,
                    toll_cost: val_toll,
                    food_cost: val_food,
                    other_costs: val_other
                }).eq('id', ticketId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('ticket_support_agents').update({
                    compensation_base_value: val_base,
                    compensation_included_hours: val_inc_h,
                    compensation_included_km: val_inc_km,
                    compensation_extra_hour_rate: val_extra_h_rate,
                    compensation_extra_km_rate: val_extra_km_rate,
                    compensation_total: totalHon,
                    toll_cost: val_toll,
                    food_cost: val_food,
                    other_costs: val_other
                }).eq('ticket_id', ticketId).eq('agent_id', agentId);
                if (error) throw error;
            }

            toast.success('Valores atualizados com sucesso.');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0 border-none bg-zinc-950 text-zinc-100">
                <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border-b border-zinc-800/50">
                    <DialogHeader>
                        <div className="flex items-center justify-between mb-2">
                            <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                <Calculator className="w-6 h-6 text-primary" />
                                Detalhes de Pagamento
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
                            Resumo completo e conferência de valores para o agente <strong>{agentInfo?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {isFetching ? (
                    <div className="p-20 text-center text-zinc-500 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Carregando informações do chamado...
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                                {/* Left Side: Details & Stats */}
                                <div className="lg:col-span-7 p-6 space-y-8 bg-zinc-900/30">
                                    
                                    {/* Detalhes | A Pagar Section */}
                                    <section>
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Info className="w-3.5 h-3.5" />
                                            Detalhes | A Pagar
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Código / Sequência</p>
                                                <p className="text-sm font-semibold text-zinc-200">{contextInfo?.code}</p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Agente</p>
                                                <p className="text-sm font-semibold text-zinc-200 uppercase">{agentInfo?.name}</p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Início Atendimento</p>
                                                <p className="text-sm font-semibold text-zinc-200">
                                                    {detailedStats.startTime ? format(detailedStats.startTime, "dd/MM/yyyy HH:mm:ss") : '--:--'}
                                                </p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Fim Atendimento</p>
                                                <p className="text-sm font-semibold text-zinc-200">
                                                    {detailedStats.endTime ? format(detailedStats.endTime, "dd/MM/yyyy HH:mm:ss") : '--:--'}
                                                </p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">KM Inicial</p>
                                                <p className="text-sm font-semibold text-zinc-200">{detailedStats.startKm} km</p>
                                            </div>
                                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">KM Final</p>
                                                <p className="text-sm font-semibold text-zinc-200">{detailedStats.endKm} km</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Resumo do Cálculo Section */}
                                    <section className="space-y-6">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5" />
                                            Resumo do Cálculo
                                        </h3>
                                        
                                        {/* Franquia */}
                                        <div className="flex items-center justify-between group">
                                            <div>
                                                <p className="text-sm font-medium text-zinc-300">Franquia Acordada</p>
                                                <p className="text-[11px] text-zinc-500">Valores inclusos no acionamento base</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded text-xs font-mono">
                                                    {includedHours}h
                                                </span>
                                                <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded text-xs font-mono">
                                                    {includedKm}KM
                                                </span>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-800/50 border-t border-dashed border-zinc-700/30" />

                                        {/* KM Excedente */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-zinc-300">Valor KM's Excedente</p>
                                                {extraKm > 0 && (
                                                    <span className="text-xs text-orange-400 font-bold">+ {costExtraKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-zinc-950 p-3 rounded border border-zinc-800/50 text-center">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">KM Total</p>
                                                    <p className="text-lg font-bold text-zinc-300">{detailedStats.totalKm}</p>
                                                </div>
                                                <div className="bg-zinc-950 p-3 rounded border border-zinc-800/50 text-center">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">KM Excedente</p>
                                                    <p className={`text-lg font-bold ${extraKm > 0 ? 'text-orange-400' : 'text-zinc-600'}`}>{extraKm}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-800/50 border-t border-dashed border-zinc-700/30" />

                                        {/* Horas Excedentes */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-zinc-300">Valor Horas Excedente</p>
                                                {extraHours > 0 && (
                                                    <span className="text-xs text-orange-400 font-bold">+ {costExtraHours.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-zinc-950 p-3 rounded border border-zinc-800/50 text-center">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total Horas</p>
                                                    <p className="text-lg font-bold text-zinc-300">{formatDuration(detailedStats.durationHours)}</p>
                                                </div>
                                                <div className="bg-zinc-950 p-3 rounded border border-zinc-800/50 text-center">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Horas Excedentes</p>
                                                    <p className={`text-lg font-bold ${extraHours > 0 ? 'text-orange-400' : 'text-zinc-600'}`}>{extraHours.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-800/50 border-t border-dashed border-zinc-700/30" />

                                    </section>
                                </div>

                                {/* Right Side: Parameters & Final Total */}
                                <div className="lg:col-span-5 p-6 space-y-6 border-l border-zinc-800/50 bg-zinc-950">
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                        <Calculator className="w-3.5 h-3.5" />
                                        Parâmetros de Ajuste
                                    </h3>

                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="compensation_base_value"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">VALOR BASE (R$)</FormLabel>
                                                    <FormControl>
                                                        <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-primary h-10 font-mono text-lg" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="compensation_included_hours"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">FRANQUIA HS</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-primary h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="compensation_included_km"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">FRANQUIA KM</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-primary h-10 font-mono" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="compensation_extra_hour_rate"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">R$ HORA EXTRA</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-primary h-10 font-mono" type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="compensation_extra_km_rate"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1.5">
                                                        <FormLabel className="text-[11px] text-zinc-500 font-bold uppercase">R$ KM EXTRA</FormLabel>
                                                        <FormControl>
                                                            <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-primary h-10 font-mono" type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="h-px bg-zinc-800 my-6" />

                                        <div className="space-y-3">
                                            <p className="text-[11px] text-zinc-500 font-bold uppercase">OUTROS REEMBOLSOS</p>
                                            <div className="grid grid-cols-1 gap-3">
                                                <FormField
                                                    control={form.control}
                                                    name="toll_cost"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center gap-3 space-y-0 bg-zinc-900 p-2 rounded border border-zinc-800">
                                                            <FormLabel className="w-24 text-[10px] text-zinc-400 font-bold uppercase">PEDÁGIO</FormLabel>
                                                            <FormControl>
                                                                <Input className="bg-transparent border-none text-right font-mono h-8 shadow-none focus-visible:ring-0" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="food_cost"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center gap-3 space-y-0 bg-zinc-900 p-2 rounded border border-zinc-800">
                                                            <FormLabel className="w-24 text-[10px] text-zinc-400 font-bold uppercase">ALIMENTAÇÃO</FormLabel>
                                                            <FormControl>
                                                                <Input className="bg-transparent border-none text-right font-mono h-8 shadow-none focus-visible:ring-0" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="other_costs"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center gap-3 space-y-0 bg-zinc-900 p-2 rounded border border-zinc-800">
                                                            <FormLabel className="w-24 text-[10px] text-zinc-400 font-bold uppercase">OUTROS</FormLabel>
                                                            <FormControl>
                                                                <Input className="bg-transparent border-none text-right font-mono h-8 shadow-none focus-visible:ring-0" type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Final Payment Boxes Section (Premium UI) */}
                                    <div className="space-y-4 pt-4 mt-auto">
                                        <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 shadow-xl overflow-hidden relative">
                                            <div className="flex justify-between items-center relative z-10">
                                                <div>
                                                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">TOTAL A PAGAR</p>
                                                    <p className="text-3xl font-black text-white leading-tight">
                                                        {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                                <div className="bg-primary/10 p-3 rounded-full">
                                                    <Calculator className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                            {/* Subtle background glow */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -mr-16 -mt-16" />
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => onOpenChange(false)}
                                                disabled={isLoading}
                                                className="flex-1 bg-transparent border-zinc-800 hover:bg-zinc-900 text-zinc-400"
                                            >
                                                CANCELAR
                                            </Button>
                                            <Button 
                                                type="submit" 
                                                disabled={isLoading} 
                                                className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground font-black tracking-widest uppercase shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                                            >
                                                {isLoading ? 'SALVANDO...' : 'SALVAR PAGAMENTO'}
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
