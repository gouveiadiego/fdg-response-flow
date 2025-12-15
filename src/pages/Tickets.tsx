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
import { Plus, Search, FileText, Calendar, MapPin, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewTicketDialog } from '@/components/tickets/NewTicketDialog';
import { EditTicketDialog } from '@/components/tickets/EditTicketDialog';
import { TicketDetails } from '@/components/tickets/TicketDetails';

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
  agents: {
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
  const [loading, setLoading] = useState(true);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [editTicketOpen, setEditTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
          agents:main_agent_id (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
      toast.error('Erro ao carregar chamados');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.agents?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsOpen(true);
  };

  const handleEdit = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setEditTicketOpen(true);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Chamados</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os atendimentos</p>
        </div>
        <Button onClick={() => setNewTicketOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

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

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum chamado encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Tente buscar com outros termos ou filtros' 
                : 'Comece criando um novo chamado'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
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
              className="hover:shadow-lg transition-shadow cursor-pointer"
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
                    {serviceTypeLabels[ticket.service_type]} • {ticket.agents?.name}
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
};

export default Tickets;
