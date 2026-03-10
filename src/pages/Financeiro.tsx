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
    FileText, HandCoins, Building2, Calculator, ChevronDown, ChevronUp, History
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
                .select(`
          id, code, start_datetime, status,
          toll_cost, food_cost, other_costs,
          main_agent_id,
          main_agent_payment_status, main_agent_paid_at,
          main_agent_compensation_total,
          revenue_status, revenue_paid_at, revenue_total,
          clients (name),
          main_agent:agents!tickets_main_agent_id_fkey (name, is_armed, pix_key, bank_name, bank_agency, bank_account, bank_account_type),
          ticket_support_agents (
            agent_id,
            toll_cost, food_cost, other_costs,
            payment_status, paid_at,
            compensation_total,
            agent:agents (name, is_armed, pix_key, bank_name, bank_agency, bank_account, bank_account_type)
          )
        `)
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
                        paidAt: ticket.main_agent_paid_at
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
                                agentRole: 'apoio_1', // Using fixed role for styling or maybe dynamic? 'apoio_1' is used for badge color logic likely.
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
                                paidAt: sa.paid_at
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

    // Agent items split by status + search
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

    // Faturamento split by status + search
    const matchesFatSearch = (t: any) =>
        !searchTerm ||
        (t.code && t.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.clients?.name && t.clients.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const pendingTickets = tickets.filter(t => (t.revenue_status || 'pendente') === 'pendente' && matchesFatSearch(t));
    const receivedTickets = tickets
        .filter(t => t.revenue_status === 'recebido' && matchesFatSearch(t))
        .sort((a, b) => new Date(b.revenue_paid_at || 0).getTime() - new Date(a.revenue_paid_at || 0).getTime());

    const pendingFaturamentoCount = tickets.filter(t => (t.revenue_status || 'pendente') === 'pendente').length;
    const receivedFaturamentoCount = tickets.filter(t => t.revenue_status === 'recebido').length;

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
                        Controle de contas a pagar e receber
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <DatePickerWithRange date={date} setDate={setDate} />
                    <Button variant="outline" onClick={fetchPayments} disabled={loading}>
                        {loading ? 'Carregando...' : 'Atualizar'}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="pagamentos" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="pagamentos" className="flex gap-2 items-center">
                        <HandCoins className="h-4 w-4" />
                        Pagamentos (Agentes)
                    </TabsTrigger>
                    <TabsTrigger value="faturamento" className="flex gap-2 items-center">
                        <Building2 className="h-4 w-4" />
                        Faturamento (Clientes)
                    </TabsTrigger>
                </TabsList>

                {/* ABA DE PAGAMENTOS (AGENTES) */}
                <TabsContent value="pagamentos" className="space-y-6">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">Total Pago no Período</p>
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

                    {/* Pending Payment Cards */}
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
                            {/* Pending section */}
                            {pendingItems.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">✅ Todos os pagamentos estão em dia!</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pendingItems.map((item, idx) => (
                                        <Card
                                            key={`${item.ticketId}-${item.agentRole}-${idx}`}
                                            className={`transition-all hover:shadow-md ${item.paymentStatus === 'pago'
                                                ? 'border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5'
                                                : 'border-border bg-card'
                                                }`}
                                        >
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${item.agentRole === 'principal' ? 'bg-primary/10' : 'bg-muted'
                                                            }`}>
                                                            {item.agentRole === 'principal'
                                                                ? <User className="h-4 w-4 text-primary" />
                                                                : <Users className="h-4 w-4 text-muted-foreground" />}
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-bold">{item.agentName}</CardTitle>
                                                            <p className="text-[10px] text-muted-foreground uppercase">
                                                                {item.agentRoleLabel} • {item.isArmed ? 'Armado' : 'Desarmado'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        className={`text-[10px] ${item.paymentStatus === 'pago'
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                                            }`}
                                                    >
                                                        {item.paymentStatus === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {/* Ticket Info */}
                                                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5">
                                                    <span>Chamado <strong className="text-foreground">{item.ticketCode}</strong></span>
                                                    <span>{item.clientName}</span>
                                                    <span>{format(new Date(item.startDatetime), 'dd/MM/yy', { locale: ptBR })}</span>
                                                </div>

                                                {/* Costs */}
                                                <div className="grid grid-cols-5 gap-2 text-center">
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Honorários</span>
                                                        <span className="text-xs font-semibold">
                                                            {(item.compensationTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Pedágio</span>
                                                        <span className="text-xs font-semibold">
                                                            {item.tollCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Alimentação</span>
                                                        <span className="text-xs font-semibold">
                                                            {item.foodCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground uppercase block">Outros</span>
                                                        <span className="text-xs font-semibold">
                                                            {item.otherCosts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                    <div className="bg-primary/5 rounded px-1">
                                                        <span className="text-[10px] text-primary/80 uppercase block font-medium">Total</span>
                                                        <span className="text-xs font-bold text-primary">
                                                            {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Bank / PIX Info */}
                                                {(item.pixKey || item.bankName) && (
                                                    <div className="bg-muted/40 rounded-lg p-2.5 space-y-1">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Dados para Pagamento</span>
                                                        </div>
                                                        {item.pixKey && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs">
                                                                    <strong>PIX:</strong> {item.pixKey}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2"
                                                                    onClick={() => copyToClipboard(item.pixKey!)}
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {item.bankName && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.bankName}
                                                                {item.bankAgency && ` • Ag: ${item.bankAgency}`}
                                                                {item.bankAccount && ` • Conta: ${item.bankAccount}`}
                                                                {item.bankAccountType && ` (${item.bankAccountType === 'corrente' ? 'CC' : 'CP'})`}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Paid At */}
                                                {item.paidAt && (
                                                    <p className="text-[10px] text-emerald-600 font-medium text-right">
                                                        Pago em {format(new Date(item.paidAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                    </p>
                                                )}

                                                {/* Action Button */}
                                                <div className="flex justify-end gap-2 pt-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1.5 border-primary/20 hover:bg-primary/5 text-primary"
                                                        onClick={() => {
                                                            setSelectedTicketId(item.ticketId);
                                                            setSelectedAgentId(item.agentId);
                                                            setSelectedAgentRole(item.agentRole);
                                                            setPagamentoAgenteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Calculator className="h-3.5 w-3.5" />
                                                        Calculadora
                                                    </Button>

                                                    {item.paymentStatus === 'pendente' ? (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Pagar
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Deseja marcar o pagamento de <strong>{item.agentName}</strong> ({item.agentRoleLabel}) do chamado <strong>{item.ticketCode}</strong> como pago?
                                                                        <br /><br />
                                                                        <strong>Valor: {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleMarkAsPaid(item)}
                                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                                    >
                                                                        Confirmar Pagamento
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    ) : (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground">
                                                                    Desfazer Pagamento
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Reverter Pagamento</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Deseja reverter o pagamento de <strong>{item.agentName}</strong> para "Pendente"?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleUndoPayment(item)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Reverter
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* History (Paid) section */}
                            {paidItems.length > 0 && (
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-semibold"
                                        onClick={() => setShowPaidHistory(v => !v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <History className="h-4 w-4 text-emerald-600" />
                                            <span>Histórico de Pagamentos</span>
                                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{paidItems.length}</span>
                                        </div>
                                        {showPaidHistory
                                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {showPaidHistory && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {paidItems.map((item, idx) => (
                                                <Card
                                                    key={`paid-${item.ticketId}-${item.agentRole}-${idx}`}
                                                    className="border-emerald-500/20 bg-emerald-500/5 opacity-80"
                                                >
                                                    <CardHeader className="pb-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`p-1.5 rounded-lg ${item.agentRole === 'principal' ? 'bg-primary/10' : 'bg-muted'}`}>
                                                                    {item.agentRole === 'principal'
                                                                        ? <User className="h-4 w-4 text-primary" />
                                                                        : <Users className="h-4 w-4 text-muted-foreground" />}
                                                                </div>
                                                                <div>
                                                                    <CardTitle className="text-sm font-bold">{item.agentName}</CardTitle>
                                                                    <p className="text-[10px] text-muted-foreground uppercase">{item.agentRoleLabel} • {item.isArmed ? 'Armado' : 'Desarmado'}</p>
                                                                </div>
                                                            </div>
                                                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">✅ Pago</Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-3">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5">
                                                            <span>Chamado <strong className="text-foreground">{item.ticketCode}</strong></span>
                                                            <span>{item.clientName}</span>
                                                            <span>{format(new Date(item.startDatetime), 'dd/MM/yy', { locale: ptBR })}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-bold text-emerald-700">
                                                                {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                            {item.paidAt && (
                                                                <p className="text-[10px] text-emerald-600 font-medium">
                                                                    Pago em {format(new Date(item.paidAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-8 text-xs">
                                                                        Desfazer Pagamento
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Reverter Pagamento</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Deseja reverter o pagamento de <strong>{item.agentName}</strong> para "Pendente"?
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleUndoPayment(item)}
                                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        >
                                                                            Reverter
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
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

                {/* ABA DE FATURAMENTO (CLIENTES) */}
                <TabsContent value="faturamento" className="space-y-6">
                    <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
                        <h2 className="text-lg font-bold text-primary mb-1">Receitas de Chamados</h2>
                        <p className="text-sm text-muted-foreground">
                            Aqui você pode definir o valor que será cobrado do cliente final para cada chamado, ajustando franquias e valores extras.
                        </p>
                    </div>

                    {/* Summary Cards Faturamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-amber-500/20 p-2 rounded-lg">
                                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">
                                        {pendingFaturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">{pendingFaturamentoCount} A Receber</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5">
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="bg-emerald-500/20 p-2 rounded-lg">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
                                        {receivedFaturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">{receivedFaturamentoCount} Recebidos</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search Faturamento */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por chamado ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-3">
                            {[1, 2, 3].map(i => (
                                <Card key={i} className="animate-pulse h-24 bg-muted/50" />
                            ))}
                        </div>
                    ) : pendingTickets.length === 0 && receivedTickets.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Nenhum chamado listado.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* A Receber */}
                            {pendingTickets.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">✅ Todos os faturamentos foram recebidos!</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {pendingTickets.map((ticket) => {
                                        const isReceived = ticket.revenue_status === 'recebido';

                                        return (
                                            <Card key={ticket.id} className={`transition-all hover:shadow-md ${isReceived
                                                ? 'border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5'
                                                : 'border-border bg-card'
                                                }`}>
                                                <CardContent className="p-4 flex flex-col h-full space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex gap-2 mb-2">
                                                                <Badge variant={ticket.status === 'finalizado' ? 'default' : 'secondary'}>
                                                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                                                </Badge>
                                                                <Badge className={
                                                                    isReceived
                                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                                                }>
                                                                    {isReceived ? '✅ Recebido' : '⏳ A Receber'}
                                                                </Badge>
                                                            </div>
                                                            <h3 className="font-bold text-base leading-tight">
                                                                Chamado {ticket.code || '-'}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                                {ticket.clients?.name || 'Cliente Desconhecido'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Data</span>
                                                            <p className="text-xs">{format(new Date(ticket.start_datetime), 'dd/MM/yyyy')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-muted/50 rounded-md p-3 flex justify-between items-center border border-muted">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">
                                                                Faturamento Calculado
                                                            </p>
                                                            <p className={`font-black tracking-tight ${ticket.revenue_total ? 'text-primary text-xl' : 'text-muted-foreground text-sm'}`}>
                                                                {ticket.revenue_total
                                                                    ? ticket.revenue_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                                    : 'Não definido'}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="bg-background border-primary/20 hover:bg-primary/5 text-primary"
                                                            onClick={() => {
                                                                setSelectedTicketId(ticket.id);
                                                                setFaturamentoDialogOpen(true);
                                                            }}
                                                        >
                                                            <FileText className="h-4 w-4 mr-2" />
                                                            Calcular
                                                        </Button>
                                                    </div>

                                                    <div className="mt-auto pt-3 border-t border-border flex justify-end items-center gap-2">
                                                        {!isReceived ? (
                                                            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto" onClick={() => handleMarkRevenueAsPaid(ticket.id)}>
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Marcar como Recebido
                                                            </Button>
                                                        ) : (
                                                            <>
                                                                {ticket.revenue_paid_at && (
                                                                    <span className="text-[10px] text-emerald-600 font-medium mr-auto">
                                                                        Recebido em {format(new Date(ticket.revenue_paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                                    </span>
                                                                )}
                                                                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-8" onClick={() => handleUndoRevenuePayment(ticket.id)}>
                                                                    Desfazer
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Histórico de Recebimentos */}
                            {receivedTickets.length > 0 && (
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-semibold"
                                        onClick={() => setShowPaidFaturamento(v => !v)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <History className="h-4 w-4 text-emerald-600" />
                                            <span>Histórico de Recebimentos</span>
                                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{receivedTickets.length}</span>
                                        </div>
                                        {showPaidFaturamento
                                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {showPaidFaturamento && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {receivedTickets.map((ticket) => {
                                                return (
                                                    <Card key={`hist-${ticket.id}`} className="border-emerald-500/20 bg-emerald-500/5 opacity-80">
                                                        <CardContent className="p-4 flex flex-col h-full space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h3 className="font-bold text-base leading-tight">Chamado {ticket.code || '-'}</h3>
                                                                    <p className="text-sm text-muted-foreground mt-0.5">{ticket.clients?.name || 'Cliente Desconhecido'}</p>
                                                                    <p className="text-xs text-muted-foreground">{format(new Date(ticket.start_datetime), 'dd/MM/yyyy')}</p>
                                                                </div>
                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">✅ Recebido</Badge>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-lg font-black text-emerald-700">
                                                                    {ticket.revenue_total
                                                                        ? ticket.revenue_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                                        : 'Não definido'}
                                                                </span>
                                                                {ticket.revenue_paid_at && (
                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                        em {format(new Date(ticket.revenue_paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-end pt-1 border-t border-border">
                                                                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-8 text-xs" onClick={() => handleUndoRevenuePayment(ticket.id)}>
                                                                    Desfazer
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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
