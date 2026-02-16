import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, FileText, Calendar, MapPin, Filter, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewTicketDialog } from '@/components/tickets/NewTicketDialog';
import { EditTicketDialog } from '@/components/tickets/EditTicketDialog';
import { TicketDetails } from '@/components/tickets/TicketDetails';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';

interface Ticket {
  id: string;
  code: string;
  status: 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado';
  city: string;
  state: string;
  start_datetime: string;
  service_type: string;
  clients: {
    name: string;
  };
  main_agent: {
    name: string;
  };
}

const statusColors = {
  aberto: 'bg-info text-info-foreground',
  em_andamento: 'bg-warning text-warning-foreground',
  finalizado: 'bg-success text-success-foreground',
  cancelado: 'bg-muted text-muted-foreground',
};

const statusLabels = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const serviceTypeLabels: Record<string, string> = {
  alarme: 'Alarme',
  averiguacao: 'Averiguação',
  preservacao: 'Preservação',
  acompanhamento_logistico: 'Acompanhamento Logístico',
};

const Tickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [editTicketOpen, setEditTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          code,
          status,
          city,
          state,
          start_datetime,
          service_type,
          clients (
            name
          ),
          main_agent:agents!tickets_main_agent_id_fkey (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Tickets loaded:', data);
      setTickets((data as unknown as Ticket[]) || []);
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
      toast.error('Erro ao carregar chamados');
      setTickets([]); // Ensure it's empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (ticket.code || '').toLowerCase().includes(searchLower) ||
      (ticket.clients?.name || '').toLowerCase().includes(searchLower) ||
      (ticket.main_agent?.name || '').toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

    // Date filter
    let matchesDate = true;
    if (dateFrom) {
      const ticketDate = new Date(ticket.start_datetime);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && ticketDate >= fromDate;
    }
    if (dateTo) {
      const ticketDate = new Date(ticket.start_datetime);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && ticketDate <= toDate;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleViewDetails = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsOpen(true);
  };

  const handleEdit = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setEditTicketOpen(true);
  };

  const handleDeleteClick = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTicketToDelete(ticketId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;

    setDeleteLoading(true);
    try {
      const { error, count } = await supabase
        .from('tickets')
        .delete({ count: 'exact' })
        .eq('id', ticketToDelete);

      if (error) throw error;

      if (count === 0) {
        toast.error('Erro: Chamado não encontrado ou permissão negada.');
      } else {
        toast.success('Chamado excluído com sucesso');
        setTickets(tickets.filter(t => t.id !== ticketToDelete));
        fetchTickets();
      }
    } catch (error: any) {
      console.error('Erro ao excluir chamado:', error);
      if (error.code === '23503') {
        toast.error('Não é possível excluir este chamado pois existem registros vinculados a ele.');
      } else {
        toast.error('Erro ao excluir chamado. Tente novamente.');
      }
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    }
  };

  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando chamados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Chamados</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os atendimentos</p>
        </div>
        <Button onClick={() => setNewTicketOpen(true)} className="hidden lg:flex">
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, cliente ou agente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data Inicial</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data Final</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDateFilters}>
              Limpar datas
            </Button>
          )}
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum chamado encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' || dateFrom || dateTo
                ? 'Tente buscar com outros termos ou filtros'
                : 'Comece criando um novo chamado'}
            </p>
            {!searchTerm && statusFilter === 'all' && !dateFrom && !dateTo && (
              <Button onClick={() => setNewTicketOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Chamado
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="hover:shadow-lg transition-shadow cursor-pointer relative group"
              onClick={() => handleViewDetails(ticket.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{ticket.code}</span>
                    </CardTitle>
                    <CardDescription className="truncate">{ticket.clients?.name}</CardDescription>
                  </div>
                  <Badge className={statusColors[ticket.status]}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{ticket.city}, {ticket.state}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {format(new Date(ticket.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">
                    {serviceTypeLabels[ticket.service_type]} • {ticket.main_agent?.name}
                  </span>
                </div>
                <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewDetails(ticket.id)}
                  >
                    Ver Detalhes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(ticket.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 px-0"
                    onClick={(e) => handleDeleteClick(ticket.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Floating Action Button for Mobile */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg lg:hidden z-50"
        onClick={() => setNewTicketOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NewTicketDialog
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        onSuccess={fetchTickets}
      />

      <EditTicketDialog
        open={editTicketOpen}
        onOpenChange={setEditTicketOpen}
        ticketId={selectedTicketId}
        onSuccess={fetchTickets}
      />

      <TicketDetails
        ticketId={selectedTicketId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={handleEdit}
        onStatusChange={fetchTickets}
      />

      <DeleteAlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Chamado"
        description="Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita."
        loading={deleteLoading}
      />
    </div>
  );
};

export default Tickets;
