import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';

interface PaymentItem {
    ticketId: string;
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
    const [filter, setFilter] = useState<'pendente' | 'pago' | 'todos'>('pendente');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select(`
          id, code, start_datetime, status,
          toll_cost, food_cost, other_costs,
          main_agent_payment_status, main_agent_paid_at,
          clients (name),
          main_agent:agents!tickets_main_agent_id_fkey (name, is_armed, pix_key, bank_name, bank_agency, bank_account, bank_account_type),
          ticket_support_agents (
            agent_id,
            toll_cost, food_cost, other_costs,
            payment_status, paid_at,
            agent:agents (name, is_armed, pix_key, bank_name, bank_agency, bank_account, bank_account_type)
          )
        `)
                .eq('status', 'finalizado')
                .order('start_datetime', { ascending: false });

            if (error) throw error;

            const paymentItems: PaymentItem[] = [];

            (data || []).forEach((ticket: any) => {
                // Main agent
                if (ticket.main_agent) {
                    const toll = Number(ticket.toll_cost) || 0;
                    const food = Number(ticket.food_cost) || 0;
                    const other = Number(ticket.other_costs) || 0;
                    paymentItems.push({
                        ticketId: ticket.id,
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
                        tollCost: toll,
                        foodCost: food,
                        otherCosts: other,
                        totalCost: toll + food + other,
                        paymentStatus: ticket.main_agent_payment_status || 'pendente',
                        paidAt: ticket.main_agent_paid_at
                    });
                }

                // Dynamic Support Agents
                if (ticket.ticket_support_agents && ticket.ticket_support_agents.length > 0) {
                    ticket.ticket_support_agents.forEach((sa: any, index: number) => {
                        if (sa.agent) {
                            const toll = Number(sa.toll_cost) || 0;
                            const food = Number(sa.food_cost) || 0;
                            const other = Number(sa.other_costs) || 0;
                            paymentItems.push({
                                ticketId: ticket.id,
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
                                tollCost: toll,
                                foodCost: food,
                                otherCosts: other,
                                totalCost: toll + food + other,
                                paymentStatus: sa.payment_status || 'pendente',
                                paidAt: sa.paid_at
                            });
                        }
                    });
                }
            });

            setItems(paymentItems);
        } catch (error) {
            console.error('Erro ao buscar pagamentos:', error);
            const msg = error instanceof Error ? error.message : 'Erro desconhecido';
            toast.error(`Erro ao carregar pagamentos: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (item: PaymentItem) => {
        const fieldMap = {
            principal: { status: 'main_agent_payment_status', paidAt: 'main_agent_paid_at' },
            apoio_1: { status: 'support_agent_1_payment_status', paidAt: 'support_agent_1_paid_at' },
            apoio_2: { status: 'support_agent_2_payment_status', paidAt: 'support_agent_2_paid_at' },
        };

        const fields = fieldMap[item.agentRole];

        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    [fields.status]: 'pago',
                    [fields.paidAt]: new Date().toISOString(),
                })
                .eq('id', item.ticketId);

            if (error) throw error;

            toast.success(`Pagamento de ${item.agentName} marcado como pago!`);
            fetchPayments();
        } catch (error) {
            console.error('Erro ao marcar pagamento:', error);
            toast.error('Erro ao atualizar pagamento');
        }
    };

    const handleUndoPayment = async (item: PaymentItem) => {
        const fieldMap = {
            principal: { status: 'main_agent_payment_status', paidAt: 'main_agent_paid_at' },
            apoio_1: { status: 'support_agent_1_payment_status', paidAt: 'support_agent_1_paid_at' },
            apoio_2: { status: 'support_agent_2_payment_status', paidAt: 'support_agent_2_paid_at' },
        };

        const fields = fieldMap[item.agentRole];

        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    [fields.status]: 'pendente',
                    [fields.paidAt]: null,
                })
                .eq('id', item.ticketId);

            if (error) throw error;

            toast.success(`Pagamento de ${item.agentName} revertido.`);
            fetchPayments();
        } catch (error) {
            console.error('Erro ao reverter pagamento:', error);
            toast.error('Erro ao reverter pagamento');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado!');
    };

    const filtered = items.filter((item) => {
        const matchesFilter =
            filter === 'todos' ||
            (filter === 'pendente' && item.paymentStatus === 'pendente') ||
            (filter === 'pago' && item.paymentStatus === 'pago');

        const matchesSearch =
            !searchTerm ||
            item.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ticketCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.clientName.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const pendingCount = items.filter(i => i.paymentStatus === 'pendente').length;
    const paidCount = items.filter(i => i.paymentStatus === 'pago').length;
    const pendingTotal = items
        .filter(i => i.paymentStatus === 'pendente')
        .reduce((sum, i) => sum + i.totalCost, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Financeiro
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Controle de pagamentos dos agentes
                    </p>
                </div>
                <Button variant="outline" onClick={fetchPayments} disabled={loading}>
                    {loading ? 'Carregando...' : 'Atualizar'}
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5">
                    <CardContent className="flex items-center gap-3 pt-4">
                        <div className="bg-amber-500/20 p-2 rounded-lg">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">{pendingCount}</p>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Pagamentos Pendentes</p>
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
                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">Pagamentos Realizados</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5">
                    <CardContent className="flex items-center gap-3 pt-4">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-500">
                                {pendingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">Total Pendente</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por agente, chamado ou cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pendente">🔴 Pendentes</SelectItem>
                            <SelectItem value="pago">🟢 Pagos</SelectItem>
                            <SelectItem value="todos">Todos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Payment Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="animate-pulse h-48 bg-muted/50" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground font-medium">
                            {filter === 'pendente'
                                ? 'Nenhum pagamento pendente!'
                                : 'Nenhum resultado encontrado.'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((item, idx) => (
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
                                <div className="grid grid-cols-4 gap-2 text-center">
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
                                <div className="flex justify-end pt-1">
                                    {item.paymentStatus === 'pendente' ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Marcar como Pago
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
        </div>
    );
};

export default Financeiro;
