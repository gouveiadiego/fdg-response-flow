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
  FileDown,
  Plus,
  Users,
} from 'lucide-react';
import { AddPhotosDialog } from './AddPhotosDialog';
import { generateTicketPDF, type TicketPDFData } from './TicketPDFGenerator';

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
  support_agent_1_arrival: string | null;
  support_agent_1_departure: string | null;
  support_agent_2_arrival: string | null;
  support_agent_2_departure: string | null;
  clients: { name: string; document: string; contact_phone: string | null };
  main_agent: { name: string; is_armed: boolean | null };
  support_agent_1: { name: string; is_armed: boolean | null } | null;
  support_agent_2: { name: string; is_armed: boolean | null } | null;
  vehicles: { 
    description: string; 
    tractor_plate: string | null;
    tractor_brand: string | null;
    tractor_model: string | null;
    trailer1_plate: string | null;
    trailer1_body_type: string | null;
    trailer2_plate: string | null;
    trailer2_body_type: string | null;
    trailer3_plate: string | null;
    trailer3_body_type: string | null;
  };
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

const bodyTypeLabels: Record<string, string> = {
  grade_baixa: 'Grade Baixa',
  grade_alta: 'Grade Alta',
  bau: 'Baú',
  sider: 'Sider',
  frigorifico: 'Frigorífico',
  container: 'Contêiner',
  prancha: 'Prancha',
};

export function TicketDetails({ ticketId, open, onOpenChange, onEdit, onStatusChange }: TicketDetailsProps) {
  const [ticket, setTicket] = useState<TicketFull | null>(null);
  const [photos, setPhotos] = useState<TicketPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [addPhotosOpen, setAddPhotosOpen] = useState(false);

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
          clients (name, document, contact_phone),
          main_agent:agents!tickets_main_agent_id_fkey (name, is_armed),
          support_agent_1:agents!tickets_support_agent_1_id_fkey (name, is_armed),
          support_agent_2:agents!tickets_support_agent_2_id_fkey (name, is_armed),
          vehicles (
            description, 
            tractor_plate, 
            tractor_brand, 
            tractor_model,
            trailer1_plate,
            trailer1_body_type,
            trailer2_plate,
            trailer2_body_type,
            trailer3_plate,
            trailer3_body_type
          ),
          plans (name)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      setTicket(data as unknown as TicketFull);
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

  const handleGeneratePDF = async () => {
    if (!ticketId) return;

    setGeneratingPDF(true);
    try {
      // Fetch fresh data from database to ensure PDF has latest info
      const { data: freshTicket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          clients (name, document, contact_phone),
          main_agent:agents!tickets_main_agent_id_fkey (name, is_armed),
          support_agent_1:agents!tickets_support_agent_1_id_fkey (name, is_armed),
          support_agent_2:agents!tickets_support_agent_2_id_fkey (name, is_armed),
          vehicles (
            description, 
            tractor_plate, 
            tractor_brand, 
            tractor_model,
            trailer1_plate,
            trailer1_body_type,
            trailer2_plate,
            trailer2_body_type,
            trailer3_plate,
            trailer3_body_type
          ),
          plans (name)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (ticketError) throw ticketError;
      if (!freshTicket) throw new Error('Ticket not found');

      // Fetch operator name from profiles
      let operatorName: string | null = null;
      if (freshTicket.created_by_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', freshTicket.created_by_user_id)
          .maybeSingle();
        operatorName = profile?.name || null;
      }

      // Fetch fresh photos
      const { data: freshPhotos, error: photosError } = await supabase
        .from('ticket_photos')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;

      const pdfData: TicketPDFData = {
        code: freshTicket.code || null,
        operator_name: operatorName,
        status: freshTicket.status,
        city: freshTicket.city,
        state: freshTicket.state,
        start_datetime: freshTicket.start_datetime,
        end_datetime: freshTicket.end_datetime,
        coordinates_lat: freshTicket.coordinates_lat,
        coordinates_lng: freshTicket.coordinates_lng,
        km_start: freshTicket.km_start,
        km_end: freshTicket.km_end,
        toll_cost: freshTicket.toll_cost,
        food_cost: freshTicket.food_cost,
        other_costs: freshTicket.other_costs,
        total_cost: freshTicket.total_cost,
        duration_minutes: freshTicket.duration_minutes,
        detailed_report: freshTicket.detailed_report,
        service_type: freshTicket.service_type,
        client: {
          name: (freshTicket as any).clients?.name || '',
          contact_phone: (freshTicket as any).clients?.contact_phone || null,
        },
        agent: {
          name: (freshTicket as any).main_agent?.name || '',
          is_armed: (freshTicket as any).main_agent?.is_armed || null,
        },
        support_agent_1: (freshTicket as any).support_agent_1 ? {
          name: (freshTicket as any).support_agent_1.name,
          is_armed: (freshTicket as any).support_agent_1.is_armed,
        } : null,
        support_agent_2: (freshTicket as any).support_agent_2 ? {
          name: (freshTicket as any).support_agent_2.name,
          is_armed: (freshTicket as any).support_agent_2.is_armed,
        } : null,
        vehicle: {
          description: (freshTicket as any).vehicles?.description || '',
          tractor_plate: (freshTicket as any).vehicles?.tractor_plate || null,
          tractor_brand: (freshTicket as any).vehicles?.tractor_brand || null,
          tractor_model: (freshTicket as any).vehicles?.tractor_model || null,
          trailer1_plate: (freshTicket as any).vehicles?.trailer1_plate || null,
          trailer1_body_type: (freshTicket as any).vehicles?.trailer1_body_type || null,
          trailer2_plate: (freshTicket as any).vehicles?.trailer2_plate || null,
          trailer2_body_type: (freshTicket as any).vehicles?.trailer2_body_type || null,
          trailer3_plate: (freshTicket as any).vehicles?.trailer3_plate || null,
          trailer3_body_type: (freshTicket as any).vehicles?.trailer3_body_type || null,
        },
        plan: {
          name: (freshTicket as any).plans?.name || '',
        },
        photos: (freshPhotos || []).map(p => ({
          file_url: p.file_url,
          caption: p.caption,
        })),
      };

      await generateTicketPDF(pdfData);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutos`;
    if (mins === 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    return `${hours} hora${hours > 1 ? 's' : ''} e ${mins} minuto${mins > 1 ? 's' : ''}`;
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
    <>
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
                  {ticket.clients?.contact_phone && (
                    <p className="text-sm text-muted-foreground">{ticket.clients.contact_phone}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Veículo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="font-semibold">{ticket.vehicles?.description}</p>
                  {ticket.vehicles?.tractor_plate && (
                    <p className="text-sm text-muted-foreground">
                      Cavalo: {ticket.vehicles.tractor_plate}
                      {ticket.vehicles.tractor_brand && ` - ${ticket.vehicles.tractor_brand}`}
                      {ticket.vehicles.tractor_model && ` ${ticket.vehicles.tractor_model}`}
                    </p>
                  )}
                  {ticket.vehicles?.trailer1_plate && (
                    <p className="text-xs text-muted-foreground">
                      Carreta 1: {ticket.vehicles.trailer1_plate} ({bodyTypeLabels[ticket.vehicles.trailer1_body_type || ''] || ticket.vehicles.trailer1_body_type})
                    </p>
                  )}
                  {ticket.vehicles?.trailer2_plate && (
                    <p className="text-xs text-muted-foreground">
                      Carreta 2: {ticket.vehicles.trailer2_plate} ({bodyTypeLabels[ticket.vehicles.trailer2_body_type || ''] || ticket.vehicles.trailer2_body_type})
                    </p>
                  )}
                  {ticket.vehicles?.trailer3_plate && (
                    <p className="text-xs text-muted-foreground">
                      Carreta 3: {ticket.vehicles.trailer3_plate} ({bodyTypeLabels[ticket.vehicles.trailer3_body_type || ''] || ticket.vehicles.trailer3_body_type})
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Equipe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-semibold">{ticket.main_agent?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Principal {ticket.main_agent?.is_armed ? '(Armado)' : '(Desarmado)'} • {ticket.plans?.name}
                    </p>
                  </div>
                  {ticket.support_agent_1 && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-sm font-medium">{ticket.support_agent_1.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Apoio 1 {ticket.support_agent_1.is_armed ? '(Armado)' : '(Desarmado)'}
                        {ticket.support_agent_1_arrival && ` • Chegada: ${format(new Date(ticket.support_agent_1_arrival), 'HH:mm')}`}
                        {ticket.support_agent_1_departure && ` • Saída: ${format(new Date(ticket.support_agent_1_departure), 'HH:mm')}`}
                      </p>
                    </div>
                  )}
                  {ticket.support_agent_2 && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-sm font-medium">{ticket.support_agent_2.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Apoio 2 {ticket.support_agent_2.is_armed ? '(Armado)' : '(Desarmado)'}
                        {ticket.support_agent_2_arrival && ` • Chegada: ${format(new Date(ticket.support_agent_2_arrival), 'HH:mm')}`}
                        {ticket.support_agent_2_departure && ` • Saída: ${format(new Date(ticket.support_agent_2_departure), 'HH:mm')}`}
                      </p>
                    </div>
                  )}
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
                      {Number(ticket.coordinates_lat).toFixed(6)}, {Number(ticket.coordinates_lng).toFixed(6)}
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
                        ? `${Number(ticket.km_end) - Number(ticket.km_start)} km`
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
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Fotos ({photos.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <div className="space-y-4">
                    {Array.from({ length: Math.ceil(photos.length / 4) }).map((_, groupIndex) => {
                      const groupPhotos = photos.slice(groupIndex * 4, (groupIndex + 1) * 4);
                      return (
                        <div key={groupIndex} className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Quadro {groupIndex + 1} — Fotos {groupIndex * 4 + 1} a {groupIndex * 4 + groupPhotos.length}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {groupPhotos.map((photo) => (
                              <div key={photo.id} className="space-y-1">
                                <a
                                  href={photo.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg border border-border hover:opacity-80 transition-opacity bg-muted">
                                    <img
                                      src={photo.file_url}
                                      alt={photo.caption || 'Foto do chamado'}
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                  </div>
                                </a>
                                {photo.caption && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{photo.caption}</p>
                                )}
                              </div>
                            ))}
                          </div>
                          {groupIndex < Math.ceil(photos.length / 4) - 1 && (
                            <Separator className="mt-3" />
                          )}
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setAddPhotosOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Mais Fotos
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma foto adicionada
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setAddPhotosOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Fotos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => onEdit(ticket.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleGeneratePDF}
                disabled={generatingPDF}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {generatingPDF ? 'Gerando...' : 'Gerar PDF'}
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

      <AddPhotosDialog
        ticketId={ticketId || ''}
        open={addPhotosOpen}
        onOpenChange={setAddPhotosOpen}
        onSuccess={fetchTicketPhotos}
      />
    </>
  );
}
