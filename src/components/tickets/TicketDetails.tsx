import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  MapPin,
  Calendar,
  User,
  Truck,
  DollarSign,
  Clock,
  Image,
  Navigation,
  CheckCircle,
  Edit,
} from 'lucide-react';

interface TicketDetailsProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (ticketId: string) => void;
  onStatusChange: () => void;
}

interface TicketFull {
  id: string;
  code: string;
  status: 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado';
  city: string;
  state: string;
  start_datetime: string;
  end_datetime: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  km_start: number | null;
  km_end: number | null;
  toll_cost: number | null;
  food_cost: number | null;
  other_costs: number | null;
  total_cost: number | null;
  duration_minutes: number | null;
  detailed_report: string | null;
  summary: string | null;
  service_type: string;
  clients: { name: string; document: string };
  agents: { name: string };
  vehicles: { description: string; plate_main: string; plate_trailer: string | null };
  plans: { name: string };
}

interface TicketPhoto {
  id: string;
  file_url: string;
  caption: string | null;
  created_at: string;
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

export function TicketDetails({ ticketId, open, onOpenChange, onEdit, onStatusChange }: TicketDetailsProps) {
  const [ticket, setTicket] = useState<TicketFull | null>(null);
  const [photos, setPhotos] = useState<TicketPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (ticketId && open) {
      fetchTicketDetails();
      fetchTicketPhotos();
    }
  }, [ticketId, open]);

  const fetchTicketDetails = async () => {
    if (!ticketId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          clients (name, document),
          agents:main_agent_id (name),
          vehicles (description, plate_main, plate_trailer),
          plans (name)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      setTicket(data);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
      toast.error('Erro ao carregar detalhes do chamado');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketPhotos = async () => {
    if (!ticketId) return;
    
    try {
      const { data, error } = await supabase
        .from('ticket_photos')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Erro ao buscar fotos:', error);
    }
  };

  const updateStatus = async (newStatus: 'em_andamento' | 'finalizado') => {
    if (!ticketId) return;
    
    setUpdatingStatus(true);
    try {
      const updateData: { 
        status: 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado'; 
        end_datetime?: string 
      } = { status: newStatus };
      
      if (newStatus === 'finalizado') {
        updateData.end_datetime = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;
      
      toast.success(`Status alterado para ${statusLabels[newStatus]}`);
      fetchTicketDetails();
      onStatusChange();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  if (loading || !ticket) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {ticket.code}
            </DialogTitle>
            <Badge className={statusColors[ticket.status]}>
              {statusLabels[ticket.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{ticket.clients?.name}</p>
                <p className="text-sm text-muted-foreground">{ticket.clients?.document}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{ticket.vehicles?.description}</p>
                <p className="text-sm text-muted-foreground">
                  {ticket.vehicles?.plate_main}
                  {ticket.vehicles?.plate_trailer && ` / ${ticket.vehicles.plate_trailer}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Agente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{ticket.agents?.name}</p>
                <p className="text-sm text-muted-foreground">{ticket.plans?.name}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{ticket.city}, {ticket.state}</p>
                {ticket.coordinates_lat && ticket.coordinates_lng && (
                  <p className="text-sm text-muted-foreground">
                    {ticket.coordinates_lat.toFixed(6)}, {ticket.coordinates_lng.toFixed(6)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dates and Duration */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Datas e Duração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Início</p>
                  <p className="font-semibold">
                    {format(new Date(ticket.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fim</p>
                  <p className="font-semibold">
                    {ticket.end_datetime 
                      ? format(new Date(ticket.end_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duração</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(ticket.duration_minutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KM and Costs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Quilometragem e Custos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">KM Inicial</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Navigation className="h-4 w-4" />
                    {ticket.km_start ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">KM Final</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Navigation className="h-4 w-4" />
                    {ticket.km_end ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">KM Rodados</p>
                  <p className="font-semibold">
                    {ticket.km_start && ticket.km_end 
                      ? `${ticket.km_end - ticket.km_start} km`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo Serviço</p>
                  <p className="font-semibold">{serviceTypeLabels[ticket.service_type]}</p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Pedágio</p>
                  <p className="font-semibold">{formatCurrency(ticket.toll_cost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alimentação</p>
                  <p className="font-semibold">{formatCurrency(ticket.food_cost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outros</p>
                  <p className="font-semibold">{formatCurrency(ticket.other_costs)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold text-primary">{formatCurrency(ticket.total_cost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report */}
          {ticket.detailed_report && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Relatório Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{ticket.detailed_report}</p>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Fotos ({photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={photo.file_url}
                        alt={photo.caption || 'Foto do chamado'}
                        className="w-full h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onEdit(ticket.id)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            
            {ticket.status === 'aberto' && (
              <Button 
                onClick={() => updateStatus('em_andamento')}
                disabled={updatingStatus}
              >
                Iniciar Atendimento
              </Button>
            )}
            
            {ticket.status === 'em_andamento' && (
              <Button 
                onClick={() => updateStatus('finalizado')}
                disabled={updatingStatus}
                className="bg-success hover:bg-success/90"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Finalizar Chamado
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
