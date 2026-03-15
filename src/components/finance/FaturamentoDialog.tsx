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
import { parseSafeNumber } from '@/lib/numberUtils';
import { Button } from '@/components/ui/button';

const optionalNumber = z.number().or(z.string().transform(v => v === '' ? undefined : Number(v))).optional();

const ALARME_PRICING = {
    base: 100,
    includedHours: 0.5,
    includedKm: 50,
    extraHourRate: 20,
    extraKmRate: 1.50,
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
    const [contextInfo, setContextInfo] = useState<{ clientName: string; plate: string; code: string } | null>(null);

    // Real stats from the ticket to calculate over
    const [ticketStats, setTicketStats] = useState({
        durationHours: 0,
        totalKm: 0,
    });

    const form = useForm<FaturamentoFormData>({
        resolver: zodResolver(faturamentoSchema),
        defaultValues: {
            revenue_base_value: 500.00,
            revenue_included_hours: 3.00,
            revenue_included_km: 50.00,
            revenue_extra_hour_rate: 90.00,
            revenue_extra_km_rate: 2.50,
            revenue_discount_addition: 0.00,
            revenue_total: 0.00,
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
          plans ( name ),
          clients ( name ),
          vehicles ( tractor_plate ),
          ticket_support_agents (
            arrival, departure, km_start, km_end
          )
        `)
                .eq('id', ticketId)
                .single();

            if (error) throw error;

            // Detect alarm plan via plan NAME (independent from service_type)
            const planName = (ticket as any).plans?.name ?? null;
            const isAlarme = planName?.toLowerCase().includes('alarme') ?? false;
            setIsAlarmPlan(isAlarme);

            setContextInfo({
                clientName: (ticket as any).clients?.name || 'Não informado',
                plate: (ticket as any).vehicles?.tractor_plate || 'Sem placa',
                code: ticket.code || '-'
            });

            // Calculate total duration
            let totalDiffMs = 0;
            if (ticket.main_agent_arrival && ticket.main_agent_departure) {
                totalDiffMs += new Date(ticket.main_agent_departure).getTime() - new Date(ticket.main_agent_arrival).getTime();
            }
            ticket.ticket_support_agents?.forEach((agent: any) => {
                if (agent.arrival && agent.departure) {
                    totalDiffMs += new Date(agent.departure).getTime() - new Date(agent.arrival).getTime();
                }
            });
            const durationHours = totalDiffMs > 0 ? totalDiffMs / (1000 * 60 * 60) : 0;

            // Calculate total KM
            let totalKm = 0;
            if (ticket.km_start && ticket.km_end) {
                totalKm += Number(ticket.km_end) - Number(ticket.km_start);
            }
            ticket.ticket_support_agents?.forEach((agent: any) => {
                if (agent.km_start && agent.km_end) {
                    totalKm += Number(agent.km_end) - Number(agent.km_start);
                }
            });

            setTicketStats({ durationHours, totalKm });

            form.reset({
                revenue_base_value: ticket.revenue_base_value ?? (isAlarme ? ALARME_PRICING.base : 500),
                revenue_included_hours: ticket.revenue_included_hours ?? (isAlarme ? ALARME_PRICING.includedHours : 3),
                revenue_included_km: ticket.revenue_included_km ?? (isAlarme ? ALARME_PRICING.includedKm : 50),
                revenue_extra_hour_rate: ticket.revenue_extra_hour_rate ?? (isAlarme ? ALARME_PRICING.extraHourRate : 90),
                revenue_extra_km_rate: ticket.revenue_extra_km_rate ?? (isAlarme ? ALARME_PRICING.extraKmRate : 2.5),
                revenue_discount_addition: ticket.revenue_discount_addition ?? 0,
                revenue_total: ticket.revenue_total ?? 0,
            });

        } catch (error) {
            console.error('Erro ao buscar dados do ticket para faturamento:', error);
            toast.error('Erro ao buscar dados do chamado.');
        } finally {
            setIsFetching(false);
        }
    };

    // Watch form values to calculate simulation
    const baseValue = form.watch('revenue_base_value') || 0;
    const includedHours = form.watch('revenue_included_hours') || 0;
    const includedKm = form.watch('revenue_included_km') || 0;
    const extraHourRate = form.watch('revenue_extra_hour_rate') || 0;
    const extraKmRate = form.watch('revenue_extra_km_rate') || 0;
    const discountAddition = form.watch('revenue_discount_addition') || 0;

    const currentDurationHours = ticketStats.durationHours;
    const currentTotalKm = ticketStats.totalKm;

    const exactExtraHours = Math.max(0, currentDurationHours - includedHours);
    const costExtraHours = exactExtraHours * extraHourRate;

    const extraKm = Math.max(0, currentTotalKm - includedKm);
    const costExtraKm = extraKm * extraKmRate;

    const calculatedRevenueTotal = baseValue + costExtraHours + costExtraKm + discountAddition;

    const onSubmit = async (data: z.infer<typeof faturamentoSchema>) => {
        if (!ticketId) return;

        setIsLoading(true);
        try {
            const revenue_base_value = parseSafeNumber(data.revenue_base_value);
            const revenue_included_hours = parseSafeNumber(data.revenue_included_hours);
            const revenue_included_km = parseSafeNumber(data.revenue_included_km);
            const revenue_extra_hour_rate = parseSafeNumber(data.revenue_extra_hour_rate);
            const revenue_extra_km_rate = parseSafeNumber(data.revenue_extra_km_rate);
            const revenue_discount_addition = parseSafeNumber(data.revenue_discount_addition);

            const extraHours = Math.max(0, ticketStats.durationHours - revenue_included_hours);
            const extraKmTotal = Math.max(0, ticketStats.totalKm - revenue_included_km);
            
            const finalRevenueTotal = revenue_base_value + 
                                     (extraHours * revenue_extra_hour_rate) + 
                                     (extraKmTotal * revenue_extra_km_rate) + 
                                     revenue_discount_addition;

            const { error } = await supabase
                .from('tickets')
                .update({
                    revenue_base_value,
                    revenue_included_hours,
                    revenue_included_km,
                    revenue_extra_hour_rate,
                    revenue_extra_km_rate,
                    revenue_discount_addition,
                    revenue_total: finalRevenueTotal,
                })
                .eq('id', ticketId);

            if (error) throw error;

            toast.success('Faturamento salvo com sucesso!');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Erro ao salvar faturamento:', error);
            toast.error('Erro ao salvar faturamento.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Faturamento Cliente</DialogTitle>
                    <DialogDescription>
                        Defina os valores de cobrança para o cliente correspondente a este chamado.
                    </DialogDescription>

                    {contextInfo && (
                        <div className="mt-4 grid grid-cols-3 gap-2 bg-muted/50 p-3 rounded-md border border-dashed border-border">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Chamado</p>
                                <p className="text-xs font-semibold">{contextInfo.code}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Cliente</p>
                                <p className="text-xs font-semibold">{contextInfo.clientName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Placa Cavalo</p>
                                <p className="text-xs font-semibold">{contextInfo.plate}</p>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {isFetching ? (
                    <div className="py-8 text-center text-muted-foreground">Carregando dados...</div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <div className="bg-muted p-4 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-lg">Parâmetros de Cobrança (Cliente)</h3>
                                    {isAlarmPlan && (
                                        <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-3 py-1 text-xs font-bold">
                                            🔔 Plano Alarme
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {isAlarmPlan
                                        ? 'Valores do Plano de Acionamento de Alarme já pré-preenchidos. Verifique e ajuste se necessário.'
                                        : 'Ajuste os valores para lidar com exceções. O sistema calcula o valor final a ser cobrado automaticamente.'}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border/50 pt-4">
                                    <FormField
                                        control={form.control}
                                        name="revenue_base_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Base (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="revenue_included_hours"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Franquia Horas (h)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.5" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="revenue_included_km"
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
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="revenue_extra_hour_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Hora Extra (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="revenue_extra_km_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor KM Extra (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="revenue_discount_addition"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ajustes Extras (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-primary/20 shadow-sm">
                                <h3 className="text-xl font-bold mb-4 text-primary">Simulação do Faturamento</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b border-border pb-2">
                                        <span>Tempo Trabalhado:</span>
                                        <strong>{currentDurationHours.toFixed(2)} h</strong>
                                    </div>
                                    <div className="flex justify-between border-b border-border pb-2">
                                        <span>Distância Rodada (Total):</span>
                                        <strong>{currentTotalKm.toFixed(2)} km</strong>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground pt-1">
                                        <span>Horas Extras ({exactExtraHours.toFixed(2)} h x R$ {extraHourRate.toFixed(2)}):</span>
                                        <span>+ R$ {costExtraHours.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground border-b border-border pb-2">
                                        <span>KM Extra ({extraKm.toFixed(2)} km x R$ {extraKmRate.toFixed(2)}):</span>
                                        <span>+ R$ {costExtraKm.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-border pb-2 pt-1 font-medium italic">
                                        <span>Ajustes Manuais:</span>
                                        <span>{discountAddition >= 0 ? '+' : '-'} R$ {Math.abs(discountAddition).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold pt-4 text-primary">
                                        <span>Total a Cobrar:</span>
                                        <span className="text-2xl tracking-tight">R$ {calculatedRevenueTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8">
                                    {isLoading ? 'Salvando...' : 'Salvar Faturamento'}
                                </Button>
                            </div>

                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
