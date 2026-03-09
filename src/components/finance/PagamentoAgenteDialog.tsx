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

const optionalNumber = z.number().or(z.string().transform(v => v === '' ? undefined : Number(v))).optional();

const compensationSchema = z.object({
    compensation_base_value: optionalNumber,
    compensation_included_hours: optionalNumber,
    compensation_included_km: optionalNumber,
    compensation_extra_hour_rate: optionalNumber,
    compensation_extra_km_rate: optionalNumber,
    compensation_total: optionalNumber,
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

            if (agentRole === 'principal') {
                const { data: ticket, error } = await supabase
                    .from('tickets')
                    .select('*')
                    .eq('id', ticketId)
                    .single();

                if (error) throw error;

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
                    total: ticket.main_agent_compensation_total
                };
            } else {
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
                    total: supportAgent.compensation_total
                };
            }

            setStats({ durationHours, totalKm });

            // Auto-calculate defaults if none exist
            const isArmed = !!agent.is_armed;
            form.reset({
                compensation_base_value: existingValues.base ?? (isArmed ? 300 : 280),
                compensation_included_hours: existingValues.incHours ?? 3,
                compensation_included_km: existingValues.incKm ?? 50,
                compensation_extra_hour_rate: existingValues.extraRate ?? (isArmed ? 45 : 40),
                compensation_extra_km_rate: existingValues.extraKmRate ?? 1.50,
                compensation_total: existingValues.total ?? 0,
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

    const calculatedTotal = baseValue + costExtraHours + costExtraKm;

    const onSubmit = async (data: CompensationFormData) => {
        setIsLoading(true);
        try {
            if (agentRole === 'principal') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        main_agent_compensation_base_value: data.compensation_base_value,
                        main_agent_compensation_included_hours: data.compensation_included_hours,
                        main_agent_compensation_included_km: data.compensation_included_km,
                        main_agent_compensation_extra_hour_rate: data.compensation_extra_hour_rate,
                        main_agent_compensation_extra_km_rate: data.compensation_extra_km_rate,
                        main_agent_compensation_total: calculatedTotal,
                    }) // Type cast if types.ts hasn't finished updating
                    .eq('id', ticketId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('ticket_support_agents')
                    .update({
                        compensation_base_value: data.compensation_base_value,
                        compensation_included_hours: data.compensation_included_hours,
                        compensation_included_km: data.compensation_included_km,
                        compensation_extra_hour_rate: data.compensation_extra_hour_rate,
                        compensation_extra_km_rate: data.compensation_extra_km_rate,
                        compensation_total: calculatedTotal,
                    })
                    .eq('ticket_id', ticketId)
                    .eq('agent_id', agentId);
                if (error) throw error;
            }

            toast.success('Honorários salvos com sucesso!');
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
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-lg">Parâmetros (Agente {agentInfo?.isArmed ? 'Armado' : 'Desarmado'})</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t pt-4">
                                    <FormField
                                        control={form.control}
                                        name="compensation_base_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor Base (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
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
                                                    <Input type="number" step="0.5" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
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
                                                    <Input type="number" step="1" {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
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
                            </div>

                            <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
                                <h3 className="text-xl font-bold mb-4 text-primary">Simulação do Pagamento</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between border-b border-primary/10 pb-2">
                                        <span>Tempo no Local:</span>
                                        <strong>{stats.durationHours.toFixed(2)} h</strong>
                                    </div>
                                    <div className="flex justify-between border-b border-primary/10 pb-2">
                                        <span>KM Rodado:</span>
                                        <strong>{stats.totalKm.toFixed(2)} km</strong>
                                    </div>
                                    <div className="flex justify-between border-b border-primary/10 pb-2">
                                        <span className="text-muted-foreground">Horas Extras ({exactExtraHours.toFixed(2)} h x R$ {extraHourRate.toFixed(2)}):</span>
                                        <span className="text-muted-foreground">+ R$ {costExtraHours.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-primary/10 pb-2">
                                        <span className="text-muted-foreground">KM Extra ({extraKm.toFixed(2)} km x R$ {extraKmRate.toFixed(2)}):</span>
                                        <span className="text-muted-foreground">+ R$ {costExtraKm.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold pt-2 text-primary">
                                        <span>Honorários Totais:</span>
                                        <span>R$ {calculatedTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                                    {isLoading ? 'Salvando...' : 'Salvar Honorários'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
