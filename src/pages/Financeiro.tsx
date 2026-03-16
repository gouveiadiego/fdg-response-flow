import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/dashboard/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    DollarSign, CheckCircle2, Clock, Search, User, Users, CreditCard, Copy, Filter,
    FileText, HandCoins, Building2, Calculator, ChevronDown, ChevronUp, History,
    Truck, Ban, Clock3
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaturamentoDialog } from '@/components/finance/FaturamentoDialog';
import { PagamentoAgenteDialog } from '@/components/finance/PagamentoAgenteDialog';

interface PaymentItem {
    ticketId: string;
    agentId: string;
    ticketCode: string;
    clientName: string;
    startDatetime: string;
    agentName: string;
    agentRole: 'principal' | 'apoio_1' | 'apoio_2';
    agentRoleLabel: string;
    isArmed: boolean | null;
    pixKey: string | null;
    bankName: string | null;
    bankAgency: string | null;
    bankAccount: string | null;
    bankAccountType: string | null;
    compensationTotal: number;
    tollCost: number;
    foodCost: number;
    otherCosts: number;
    totalCost: number;
    paymentStatus: string;
    paidAt: string | null;
    endDatetime: string | null;
    serviceType: string;
    tractorPlate: string | null;
}

const Financeiro = () => {
    const [items, setItems] = useState<PaymentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tickets, setTickets] = useState<any[]>([]);
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });
    const [showPaidHistory, setShowPaidHistory] = useState(false);
    const [showPaidFaturamento, setShowPaidFaturamento] = useState(false);

    // Faturamento Dialog State
    const [faturamentoDialogOpen, setFaturamentoDialogOpen] = useState(false);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    // Pagamento Agente Dialog State
    const [pagamentoAgenteDialogOpen, setPagamentoAgenteDialogOpen] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedAgentRole, setSelectedAgentRole] = useState<'principal' | 'apoio_1' | 'apoio_2'>('principal');

    useEffect(() => {
        fetchPayments();
    }, [date]);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('tickets')
                .select([
                    'id', 'code', 'start_datetime', 'end_datetime', 'status', 'service_type',
                    'toll_cost', 'food_cost', 'other_costs',
                    'main_agent_id',
                    'main_agent_payment_status', 'main_agent_paid_at',
                    'main_agent_compensation_total',
                    'revenue_status', 'revenue_paid_at', 'revenue_total',
                    'clients(name)',
                    'vehicles(tractor_plate)',
                    'main_agent:agents!tickets_main_agent_id_fkey(name,is_armed,pix_key,bank_name,bank_agency,bank_account,bank_account_type)',
                    'ticket_support_agents(agent_id,toll_cost,food_cost,other_costs,payment_status,paid_at,compensation_total,agent:agents(name,is_armed,pix_key,bank_name,bank_agency,bank_account,bank_account_type))'
                ].join(','))
                .eq('status', 'finalizado')
                .order('start_datetime', { ascending: false });

            if (date?.from) {
                query = query.gte('start_datetime', date.from.toISOString());
            }
            if (date?.to) {
                const endOfDay = new Date(date.to);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('start_datetime', endOfDay.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                console.error('Supabase error fetching payments:', error);
                throw error;
            }

            setTickets(data || []);
            const paymentItems: PaymentItem[] = [];

            (data || []).forEach((ticket: any) => {
                // Main agent
                if (ticket.main_agent) {
                    const compensation = Number(ticket.main_agent_compensation_total) || 0;
                    const toll = Number(ticket.toll_cost) || 0;
                    const food = Number(ticket.food_cost) || 0;
                    const other = Number(ticket.other_costs) || 0;
                    paymentItems.push({
                        ticketId: ticket.id,
                        agentId: ticket.main_agent_id,
                        ticketCode: ticket.code || '-',
                        clientName: ticket.clients?.name || '-',
                        startDatetime: ticket.start_datetime,
                        agentName: ticket.main_agent.name,
                        agentRole: 'principal',
                        agentRoleLabel: 'Agente Principal',
                        isArmed: ticket.main_agent.is_armed,
                        pixKey: ticket.main_agent.pix_key,
                        bankName: ticket.main_agent.bank_name,
                        bankAgency: ticket.main_agent.bank_agency,
                        bankAccount: ticket.main_agent.bank_account,
                        bankAccountType: ticket.main_agent.bank_account_type,
                        compensationTotal: compensation,
                        tollCost: toll,
                        foodCost: food,
                        otherCosts: other,
                        totalCost: compensation + toll + food + other,
                        paymentStatus: ticket.main_agent_payment_status || 'pendente',
                        paidAt: ticket.main_agent_paid_at,
                        endDatetime: ticket.end_datetime,
                        serviceType: ticket.service_type || '',
                        tractorPlate: ticket.vehicles?.tractor_plate || null
                    });
                }

                // Dynamic Support Agents
                if (ticket.ticket_support_agents && ticket.ticket_support_agents.length > 0) {
                    ticket.ticket_support_agents.forEach((sa: any, index: number) => {
                        if (sa.agent) {
                            const compensation = Number(sa.compensation_total) || 0;
                            const toll = Number(sa.toll_cost) || 0;
                            const food = Number(sa.food_cost) || 0;
                            const other = Number(sa.other_costs) || 0;
                            paymentItems.push({
                                ticketId: ticket.id,
                                agentId: sa.agent_id,
                                ticketCode: ticket.code || '-',
                                clientName: ticket.clients?.name || '-',
                                startDatetime: ticket.start_datetime,
                                agentName: sa.agent.name,
                                agentRole: 'apoio_1',
                                agentRoleLabel: `Apoio ${index + 1}`,
                                isArmed: sa.agent.is_armed,
                                pixKey: sa.agent.pix_key,
                                bankName: sa.agent.bank_name,
                                bankAgency: sa.agent.bank_agency,
                                bankAccount: sa.agent.bank_account,
                                bankAccountType: sa.agent.bank_account_type,
                                compensationTotal: compensation,
                                tollCost: toll,
                                foodCost: food,
                                otherCosts: other,
                                totalCost: compensation + toll + food + other,
                                paymentStatus: sa.payment_status || 'pendente',
                                paidAt: sa.paid_at,
                                endDatetime: ticket.end_datetime,
                                serviceType: ticket.service_type || '',
                                tractorPlate: ticket.vehicles?.tractor_plate || null
                            });
                        }
                    });
                }
            });

            setItems(paymentItems);
        } catch (error: any) {
            console.error('Erro ao buscar pagamentos:', error);
            const msg = error?.message || 'Erro desconhecido';
            toast.error(`Erro ao carregar pagamentos: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (item: PaymentItem) => {
        try {
            if (item.agentRole === 'principal') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        main_agent_payment_status: 'pago',
                        main_agent_paid_at: new Date().toISOString(),
                    })
                    .eq('id', item.ticketId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('ticket_support_agents')
                    .update({
                        payment_status: 'pago',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('ticket_id', item.ticketId)
                    .eq('agent_id', item.agentId);

                if (error) throw error;
            }

            toast.success(`Pagamento de ${item.agentName} marcado como pago!`);
            fetchPayments();
        } catch (error) {
            console.error('Erro ao marcar pagamento:', error);
            toast.error('Erro ao atualizar pagamento');
        }
    };

    const handleUndoPayment = async (item: PaymentItem) => {
        try {
            if (item.agentRole === 'principal') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        main_agent_payment_status: 'pendente',
                        main_agent_paid_at: null,
                    })
                    .eq('id', item.ticketId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('ticket_support_agents')
                    .update({
                        payment_status: 'pendente',
                        paid_at: null,
                    })
                    .eq('ticket_id', item.ticketId)
                    .eq('agent_id', item.agentId);

                if (error) throw error;
            }

            toast.success(`Pagamento de ${item.agentName} revertido.`);
            fetchPayments();
        } catch (error) {
            console.error('Erro ao reverter pagamento:', error);
            toast.error('Erro ao reverter pagamento');
        }
    };

    const handleMarkRevenueAsPaid = async (ticketId: string) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    revenue_status: 'recebido',
                    revenue_paid_at: new Date().toISOString(),
                })
                .eq('id', ticketId);

            if (error) throw error;
            toast.success('Faturamento marcado como recebido!');
            fetchPayments();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao marcar faturamento como recebido');
        }
    };

    const handleUndoRevenuePayment = async (ticketId: string) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    revenue_status: 'pendente',
                    revenue_paid_at: null,
                })
                .eq('id', ticketId);

            if (error) throw error;
            toast.success('Recebimento revertido.');
            fetchPayments();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao reverter recebimento do cliente');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado!');
    };

    const getDeadlineInfo = (item: PaymentItem) => {
        if (item.serviceType !== 'alarme' || !item.endDatetime || item.paymentStatus === 'pago') return null;

        const end = new Date(item.endDatetime);
        const deadline = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffMs < 0) {
            return {
                label: 'PAGAMENTO ATRASADO',
                variant: 'destructive' as const,
                icon: <Ban className="h-3 w-3 mr-1" />
            };
        }

        return {
            label: `Pagar em ${diffHours}h ${diffMins}m`,
            variant: 'outline' as const,
            className: diffHours < 4 ? 'text-red-600 border-red-200 bg-red-50 animate-pulse' : 'text-orange-600 border-orange-200 bg-orange-50',
            icon: <Clock3 className="h-3 w-3 mr-1" />
        };
    };

    const matchesAgentSearch = (item: PaymentItem) =>
        !searchTerm ||
        item.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ticketCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    const pendingItems = items.filter(i => i.paymentStatus === 'pendente' && matchesAgentSearch(i));
    const paidItems = items
        .filter(i => i.paymentStatus === 'pago' && matchesAgentSearch(i))
        .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

    const pendingCount = items.filter(i => i.paymentStatus === 'pendente').length;
    const paidCount = items.filter(i => i.paymentStatus === 'pago').length;
    const pendingTotal = items
        .filter(i => i.paymentStatus === 'pendente')
        .reduce((sum, i) => sum + i.totalCost, 0);
    const paidTotal = items
        .filter(i => i.paymentStatus === 'pago')
        .reduce((sum, i) => sum + i.totalCost, 0);

    const matchesFatSearch = (t: any) =>
        !searchTerm ||
        (t.code && t.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.clients?.name && t.clients.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const pendingTickets = tickets.filter(t => (t.revenue_status || 'pendente') === 'pendente' && matchesFatSearch(t));
    const receivedTickets = tickets
        .filter(t => t.revenue_status === 'recebido' && matchesFatSearch(t))
        .sort((a, b) => new Date(b.revenue_paid_at || 0).getTime() - new Date(a.revenue_paid_at || 0).getTime());

    const pendingFaturamentoTotal = tickets
        .filter(t => (t.revenue_status || 'pendente') === 'pendente')
        .reduce((sum, t) => sum + (Number(t.revenue_total) || 0), 0);

    const receivedFaturamentoTotal = tickets
        .filter(t => t.revenue_status === 'recebido')
        .reduce((sum, t) => sum + (Number(t.revenue_total) || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Financeiro
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestão de Honorários e Faturamentos • Falco Peregrinus
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <DatePickerWithRange date={date} setDate={setDate} />
                    <Button variant="outline" onClick={fetchPayments} disabled={loading}>
                        {loading ? 'Carregando...' : 'Atualizar'}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="pagamentos" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger 
                        value="pagamentos" 
                        className="flex gap-2 items-center data-[state=active]:text-red-600 data-[state=active]:bg-red-50 dark:data-[state=active]:bg-red-950/30"
                    >
                        <HandCoins className="h-4 w-4" />
                        Pagamentos (Agentes)
                    </TabsTrigger>
                    <TabsTrigger 
                        value="faturamento" 
                        className="flex gap-2 items-center data-[state=active]:text-emerald-600 data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-950/30"
                    >
                        <Building2 className="h-4 w-4" />
                        Faturamento (Clientes)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pagamentos" className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        <Card className="border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-amber-500/20 p-2 rounded-lg">
                                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">{pendingCount}</p>
                                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Pendentes</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-emerald-500/20 p-2 rounded-lg">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">{paidCount}</p>
                                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">Realizados</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-blue-500/20 p-2 rounded-lg">
                                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-blue-700 dark:text-blue-500">
                                        {pendingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">Total Pendente</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-700/20 bg-emerald-700/10 dark:bg-emerald-700/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-emerald-700/20 p-2 rounded-lg">
                                    <History className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
                                        {paidTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Total Pago</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por agente, chamado ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <Card key={i} className="animate-pulse h-48 bg-muted/50" />
                            ))}
                        </div>
                    ) : pendingItems.length === 0 && paidItems.length === 0 ? (
                        <Card className="text-center py-12">
                            <CardContent>
                                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-muted-foreground font-medium">Nenhum pagamento encontrado.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* Pending Payments */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingItems.map((item, idx) => (
                                    <Card
                                        key={`${item.ticketId}-${item.agentRole}-${idx}`}
                                        className="transition-all hover:shadow-md border-border bg-card overflow-hidden"
                                    >
                                        <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${item.agentRole === 'principal' ? 'bg-primary/10' : 'bg-muted'}`}>
                                                        {item.agentRole === 'principal'
                                                            ? <User className="h-4 w-4 text-primary" />
                                                            : <Users className="h-4 w-4 text-muted-foreground" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                            {item.agentName}
                                                            <Badge variant="outline" className="text-[9px] h-4 py-0 font-normal uppercase opacity-70">
                                                                {item.agentRoleLabel}
                                                            </Badge>
                                                        </CardTitle>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
                                                            <span>Chamado <strong>{item.ticketCode}</strong></span>
                                                            <span>•</span>
                                                            <span>{item.isArmed ? 'Armado' : 'Desarmado'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
                                                        ⏳ Pendente
                                                    </Badge>
                                                    {getDeadlineInfo(item) && (
                                                        <Badge 
                                                            variant={getDeadlineInfo(item)?.variant} 
                                                            className={`text-[9px] py-0 h-4 ${getDeadlineInfo(item)?.className || ''}`}
                                                        >
                                                            {getDeadlineInfo(item)?.icon}
                                                            {getDeadlineInfo(item)?.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        
                                        <CardContent className="pt-4 space-y-4">
                                            {/* Info: Client and Vehicle */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between bg-accent/30 rounded px-2.5 py-1.5 border border-primary/10">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-tighter">Cliente</span>
                                                        <span className="text-sm font-bold text-foreground leading-tight">{item.clientName}</span>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-tighter">Data</span>
                                                        <span className="text-[11px] font-medium">{format(new Date(item.startDatetime), 'dd/MM/yyyy')}</span>
                                                    </div>
                                                </div>

                                                {item.serviceType !== 'alarme' && item.tractorPlate && (
                                                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 rounded border border-blue-200/50 dark:border-blue-900/30">
                                                        <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] uppercase text-blue-600/70 dark:text-blue-400/70 font-bold leading-none">Placa Cavalo</span>
                                                            <span className="text-xs font-black text-blue-800 dark:text-blue-300">{item.tractorPlate}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total vs Compensation */}
                                            <div className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 rounded-lg p-3.5 border border-primary/10">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Custo Total</span>
                                                    <span className="text-2xl font-black text-primary tracking-tighter">
                                                        {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-0.5">Honorários</span>
                                                    <span className="text-sm font-bold text-foreground">
                                                        {(item.compensationTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bank / PIX Info */}
                                            {(item.pixKey || item.bankName) && (
                                                <div className="bg-muted/40 rounded-lg p-2.5 space-y-1 mt-1 border border-dashed border-muted-foreground/20">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Dados Bancários</span>
                                                    </div>
                                                    {item.pixKey && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium">PIX: {item.pixKey}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                                                                onClick={() => copyToClipboard(item.pixKey!)}
                                                            >
                                                                <Copy className="h-3 w-3 mr-1" />
                                                                <span className="text-[10px]">Copiar</span>
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {item.bankName && (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {item.bankName} • Ag: {item.bankAgency || '-'} • Conta: {item.bankAccount || '-'}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer Actions */}
                                            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2 border-primary/20 hover:bg-primary/5 text-primary font-bold shadow-sm"
                                                    onClick={() => {
                                                        setSelectedTicketId(item.ticketId);
                                                        setSelectedAgentId(item.agentId);
                                                        setSelectedAgentRole(item.agentRole);
                                                        setPagamentoAgenteDialogOpen(true);
                                                    }}
                                                >
                                                    <Calculator className="h-4 w-4" />
                                                    Calculadora
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 px-5 transition-all active:scale-95">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Pagar
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Deseja marcar o pagamento de <strong>{item.agentName}</strong> (Chamado {item.ticketCode}) como pago?
                                                                <br /><br />
                                                                <strong>Total: {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleMarkAsPaid(item)}
                                                                className="bg-emerald-600 hover:bg-emerald-700"
                                                            >
                                                                Marcar como Pago
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Paid History */}
                            {paidItems.length > 0 && (
                                <div className="mt-8 border border-border rounded-lg overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-semibold"
                                        onClick={() => setShowPaidHistory(v => !v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <History className="h-4 w-4 text-emerald-600" />
                                            <span>Histórico de Pagamentos Realizados</span>
                                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{paidItems.length}</span>
                                        </div>
                                        {showPaidHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    {showPaidHistory && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {paidItems.map((item, idx) => (
                                                <Card key={`paid-${idx}`} className="border-emerald-500/10 bg-emerald-500/5 opacity-80 shadow-none">
                                                    <CardContent className="p-4 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-bold text-sm">{item.agentName}</h4>
                                                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Chamado {item.ticketCode} • {item.clientName}</p>
                                                            </div>
                                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] border-emerald-200">✅ Pago</Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-emerald-700">{item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                            <span className="text-[10px] text-muted-foreground italic">pago em {item.paidAt ? format(new Date(item.paidAt), 'dd/MM/yy HH:mm') : '-'}</span>
                                                        </div>
                                                        <div className="pt-2 border-t border-emerald-500/10 flex justify-end">
                                                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-destructive" onClick={() => handleUndoPayment(item)}>Reverter</Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="faturamento" className="space-y-6">
                    <div className="bg-primary/5 rounded-lg border border-primary/20 p-4 mt-4">
                        <h2 className="text-lg font-bold text-primary mb-1">Receitas de Chamados</h2>
                        <p className="text-sm text-muted-foreground">Controle de recebimentos dos clientes finais.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 shadow-sm">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-amber-500/20 p-2 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
                                <div>
                                    <p className="text-2xl font-bold text-amber-700">{pendingFaturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    <p className="text-xs text-amber-600 font-medium tracking-wide font-sans">{pendingTickets.length} Chamados a Receber</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5 shadow-sm">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-emerald-500/20 p-2 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                                <div>
                                    <p className="text-2xl font-bold text-emerald-700">{receivedFaturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    <p className="text-xs text-emerald-600 font-medium tracking-wide font-sans">{receivedTickets.length} Recebidos</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por chamado ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="space-y-6">
                        {pendingTickets.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {pendingTickets.map((ticket) => (
                                    <Card key={ticket.id} className="border-border bg-card hover:shadow-md transition-all">
                                        <CardContent className="p-4 flex flex-col h-full space-y-3">
                                            <div className="flex justify-between items-start border-b border-border/50 pb-2 mb-1">
                                                <div>
                                                    <h3 className="font-bold text-primary">Chamado {ticket.code || '-'}</h3>
                                                    <p className="text-xs text-muted-foreground font-medium">{ticket.clients?.name}</p>
                                                </div>
                                                <Badge className="bg-amber-100 text-amber-700 text-[10px]">A Receber</Badge>
                                            </div>
                                            <div className="flex justify-between items-center py-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor Faturado</span>
                                                    <span className="text-lg font-black">{Number(ticket.revenue_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:bg-primary/5" onClick={() => { setSelectedTicketId(ticket.id); setFaturamentoDialogOpen(true); }}>Ajustar</Button>
                                            </div>
                                            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2" onClick={() => handleMarkRevenueAsPaid(ticket.id)}>Marcar como Recebido</Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {receivedTickets.length > 0 && (
                            <div className="mt-8 border border-border rounded-lg overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-semibold"
                                    onClick={() => setShowPaidFaturamento(v => !v)}
                                >
                                    <div className="flex items-center gap-2">
                                        <History className="h-4 w-4 text-emerald-600" />
                                        <span>Histórico de Faturamento Recebido</span>
                                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{receivedTickets.length}</span>
                                    </div>
                                    {showPaidFaturamento ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                {showPaidFaturamento && (
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {receivedTickets.map((ticket) => (
                                            <Card key={`rec-${ticket.id}`} className="opacity-80 shadow-none border-emerald-500/10">
                                                <CardContent className="p-4 pt-4 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-xs font-bold">Chamado {ticket.code}</h4>
                                                        <Badge className="bg-emerald-50 text-emerald-700 text-[9px]">Recebido</Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">{ticket.clients?.name} • {format(new Date(ticket.start_datetime), 'dd/MM/yy')}</p>
                                                    <div className="flex justify-between items-center pt-1">
                                                        <span className="text-sm font-bold text-emerald-700">{Number(ticket.revenue_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleUndoRevenuePayment(ticket.id)}>Reverter</Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <FaturamentoDialog
                open={faturamentoDialogOpen}
                onOpenChange={setFaturamentoDialogOpen}
                ticketId={selectedTicketId}
                onSuccess={fetchPayments}
            />

            <PagamentoAgenteDialog
                open={pagamentoAgenteDialogOpen}
                onOpenChange={setPagamentoAgenteDialogOpen}
                ticketId={selectedTicketId}
                agentId={selectedAgentId}
                agentRole={selectedAgentRole}
                onSuccess={fetchPayments}
            />
        </div>
    );
};

export default Financeiro;
