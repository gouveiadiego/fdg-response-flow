import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { Button } from '@/components/ui/button';
import { parseSafeNumber } from '@/lib/numberUtils';

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
 *
 * Plan rules:
 *  - "1 Agente Armado"         → principal = armed
 *  - "1 Agente Desarmado"      → principal = unarmed
 *  - "1 Armado + 1 Desarmado"  → principal = armed, support = unarmed
 *  - "2 Agentes Armados"       → all = armed
 *  - anything else             → fall back to agent's own is_armed flag
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
    const [isAlarmPlan, setIsAlarmPlan] = useState(false);
    const [planName, setPlanName] = useState<string | null>(null);

    // Real stats from the ticket to calculate over
    const [stats, setStats] = useState({
        durationHours: 0,
        totalKm: 0,
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
            // Get Agent armed status
            const { data: agent, error: agentError } = await supabase
                .from('agents')
                .select('name, is_armed')
                .eq('id', agentId)
                .single();

            if (agentError) throw agentError;
            setAgentInfo({ name: agent.name, isArmed: !!agent.is_armed });

            // Get Ticket/Support data to check existing values and calculate stats
            let durationHours = 0;
            let totalKm = 0;
            let existingValues: any = {};
            let ticketPlanName: string | null = null;
            let ticketServiceType: string | null = null;

            if (agentRole === 'principal') {
                const { data: ticket, error } = await supabase
                    .from('tickets')
                    .select('*, plans(name)')
                    .eq('id', ticketId)
                    .single();

                if (error) throw error;

                ticketServiceType = ticket.service_type;
                ticketPlanName = (ticket as any).plans?.name ?? null;
                setPlanName(ticketPlanName);

                const isAlarme = ticketPlanName?.toLowerCase().includes('alarme') ?? false;
                setIsAlarmPlan(isAlarme);

                if (ticket.main_agent_arrival && ticket.main_agent_departure) {
                    durationHours = (new Date(ticket.main_agent_departure).getTime() - new Date(ticket.main_agent_arrival).getTime()) / (1000 * 60 * 60);
                }
                if (ticket.km_start && ticket.km_end) {
                    totalKm = Number(ticket.km_end) - Number(ticket.km_start);
                }

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
                // For support agents, also fetch the ticket to get plan + service_type
                const { data: ticketData, error: ticketErr } = await supabase
                    .from('tickets')
                    .select('service_type, plans(name)')
                    .eq('id', ticketId)
                    .single();

                if (!ticketErr && ticketData) {
                    ticketServiceType = ticketData.service_type;
                    ticketPlanName = (ticketData as any).plans?.name ?? null;
                    setPlanName(ticketPlanName);
                    const isAlarme = ticketPlanName?.toLowerCase().includes('alarme') ?? false;
                    setIsAlarmPlan(isAlarme);
                }

                const { data: supportAgent, error } = await supabase
                    .from('ticket_support_agents')
                    .select('*')
                    .eq('ticket_id', ticketId)
                    .eq('agent_id', agentId)
                    .maybeSingle();

                if (error) throw error;
                if (!supportAgent) throw new Error('Agente de apoio não encontrado para este chamado.');

                if (supportAgent.arrival && supportAgent.departure) {
                    durationHours = (new Date(supportAgent.departure).getTime() - new Date(supportAgent.arrival).getTime()) / (1000 * 60 * 60);
                }
                if (supportAgent.km_start && supportAgent.km_end) {
                    totalKm = Number(supportAgent.km_end) - Number(supportAgent.km_start);
                }

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

            setStats({ durationHours, totalKm });

            // Determine if this agent, in their role, should be priced as armed or unarmed
            // Alarm detection: use PLAN NAME (independent from service_type field)
            const isAlarme = ticketPlanName?.toLowerCase().includes('alarme') ?? false;
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
            console.error('Erro ao buscar dados para honorários:', error);
            toast.error('Erro ao buscar dados do agente.');
        } finally {
            setIsFetching(false);
        }
    };

    // Calculation logic
    const baseValue = form.watch('compensation_base_value') || 0;
    const includedHours = form.watch('compensation_included_hours') || 0;
    const includedKm = form.watch('compensation_included_km') || 0;
    const extraHourRate = form.watch('compensation_extra_hour_rate') || 0;
    const extraKmRate = form.watch('compensation_extra_km_rate') || 0;

    const exactExtraHours = Math.max(0, stats.durationHours - includedHours);
    const costExtraHours = exactExtraHours * extraHourRate;

    const extraKm = Math.max(0, stats.totalKm - includedKm);
    const costExtraKm = extraKm * extraKmRate;

    const baseHonorario = baseValue + costExtraHours + costExtraKm;

    const tollCost = form.watch('toll_cost') || 0;
    const foodCost = form.watch('food_cost') || 0;
    const otherCosts = form.watch('other_costs') || 0;

    const calculatedTotal = baseHonorario + tollCost + foodCost + otherCosts;

    const onSubmit = async (data: CompensationFormData) => {
        setIsLoading(true);
        try {
            // Recalculate total inside onSubmit to ensure we use the latest values being saved
            const compensation_base_value = parseSafeNumber(data.compensation_base_value);
            const compensation_included_hours = parseSafeNumber(data.compensation_included_hours);
            const compensation_included_km = parseSafeNumber(data.compensation_included_km);
            const compensation_extra_hour_rate = parseSafeNumber(data.compensation_extra_hour_rate);
            const compensation_extra_km_rate = parseSafeNumber(data.compensation_extra_km_rate);

            const toll_cost = parseSafeNumber(data.toll_cost);
            const food_cost = parseSafeNumber(data.food_cost);
            const other_costs = parseSafeNumber(data.other_costs);

            const extraHours = Math.max(0, stats.durationHours - compensation_included_hours);
            const extraKm = Math.max(0, stats.totalKm - compensation_included_km);
            const honorarioTotal = compensation_base_value + (extraHours * compensation_extra_hour_rate) + (extraKm * compensation_extra_km_rate);
            const finalTotal = honorarioTotal + toll_cost + food_cost + other_costs;

            if (agentRole === 'principal') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        main_agent_compensation_base_value: compensation_base_value,
                        main_agent_compensation_included_hours: compensation_included_hours,
                        main_agent_compensation_included_km: compensation_included_km,
                        main_agent_compensation_extra_hour_rate: compensation_extra_hour_rate,
                        main_agent_compensation_extra_km_rate: compensation_extra_km_rate,
                        main_agent_compensation_total: honorarioTotal,
                        toll_cost: toll_cost,
                        food_cost: food_cost,
                        other_costs: other_costs
                    })
                    .eq('id', ticketId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('ticket_support_agents')
                    .update({
                        compensation_base_value,
                        compensation_included_hours,
                        compensation_included_km,
                        compensation_extra_hour_rate,
                        compensation_extra_km_rate,
                        compensation_total: honorarioTotal,
                        toll_cost,
                        food_cost,
                        other_costs
                    })
                    .eq('ticket_id', ticketId)
                    .eq('agent_id', agentId);

                if (error) throw error;
            }

            toast.success(`Pagamento de ${agentInfo?.name || 'agente'} atualizado.`);
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Erro ao salvar honorários:', error);
            toast.error('Erro ao salvar honorários.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Honorários do Agente</DialogTitle>
                    <DialogDescription>
                        Calcule o valor a ser pago para <strong>{agentInfo?.name}</strong> neste chamado.
                    </DialogDescription>
                </DialogHeader>

                {isFetching ? (
                    <div className="py-8 text-center">Carregando dados...</div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <div className="bg-muted p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg">Parâmetros (Agente {agentInfo?.isArmed ? 'Armado' : 'Desarmado'})</h3>
                                    <div className="flex items-center gap-2">
                                        {planName && !isAlarmPlan && (
                                            <span className="inline-flex items-center bg-muted text-muted-foreground border border-border rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                                                {planName}
                                            </span>
                                        )}
                                        {isAlarmPlan && (
                                            <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-3 py-1 text-xs font-bold">
                                                🔔 Plano Alarme
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t pt-4">
                                    <FormField
                                        control={form.control}
                                        name="compensation_base_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Base (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="compensation_included_hours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Franquia Horas (h)</FormLabel>
                                                <FormControl>
                                                    <Input type="text" inputMode="decimal" {...field} value={field.value || ''} onChange={(e) => field.onChange(parseSafeNumber(e.target.value))} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="compensation_included_km"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Franquia KM</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseSafeNumber(e.target.value))}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="compensation_extra_hour_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Hora Extra (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="compensation_extra_km_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor KM Extra (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={isLoading}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                                        {isLoading ? 'Salvando...' : 'Salvar Pagamento'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
