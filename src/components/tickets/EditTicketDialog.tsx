import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { AgentMap } from '@/components/agents/AgentMap';
import { MapPin, Search, Loader2, Upload, X, Camera, Trash2, Check, ChevronsUpDown } from 'lucide-react';

const ticketSchema = z.object({
  status: z.enum(['aberto', 'em_andamento', 'finalizado', 'cancelado']),
  client_id: z.string().min(1, 'Cliente é obrigatório'),
  vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
  main_agent_id: z.string().min(1, 'Selecione um agente'),
  main_agent_arrival: z.string().optional(),
  main_agent_departure: z.string().optional(),
  support_agent_1_id: z.string().optional(),
  support_agent_1_arrival: z.string().optional(),
  support_agent_1_departure: z.string().optional(),
  support_agent_1_km_start: z.coerce.number().optional().nullable(),
  support_agent_1_km_end: z.coerce.number().optional().nullable(),
  support_agent_1_toll_cost: z.coerce.number().optional().nullable(),
  support_agent_1_food_cost: z.coerce.number().optional().nullable(),
  support_agent_1_other_costs: z.coerce.number().optional().nullable(),
  support_agent_2_id: z.string().optional(),
  support_agent_2_arrival: z.string().optional(),
  support_agent_2_departure: z.string().optional(),
  support_agent_2_km_start: z.coerce.number().optional().nullable(),
  support_agent_2_km_end: z.coerce.number().optional().nullable(),
  support_agent_2_toll_cost: z.coerce.number().optional().nullable(),
  support_agent_2_food_cost: z.coerce.number().optional().nullable(),
  support_agent_2_other_costs: z.coerce.number().optional().nullable(),
  plan_id: z.string().min(1, 'Plano é obrigatório'),
  service_type: z.enum(['alarme', 'averiguacao', 'preservacao', 'acompanhamento_logistico']),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(2, 'Estado é obrigatório').max(2),
  start_datetime: z.string().min(1, 'Data/hora início é obrigatória'),
  end_datetime: z.string().optional(),
  coordinates_lat: z.coerce.number().optional().nullable(),
  coordinates_lng: z.coerce.number().optional().nullable(),
  km_start: z.coerce.number().optional().nullable(),
  km_end: z.coerce.number().optional().nullable(),
  toll_cost: z.coerce.number().optional().nullable(),
  food_cost: z.coerce.number().optional().nullable(),
  other_costs: z.coerce.number().optional().nullable(),
  summary: z.string().max(500).optional(),
  detailed_report: z.string().max(5000).optional(),
  operator_id: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface Client {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  description: string;
  client_id: string;
}

interface Agent {
  id: string;
  name: string;
  is_armed: boolean | null;
}

interface Plan {
  id: string;
  name: string;
}

interface Operator {
  id: string;
  name: string;
}

interface ExistingPhoto {
  id: string;
  file_url: string;
  caption: string | null;
}

interface PhotoToUploadGroup {
  files: { file: File; preview: string }[];
  caption: string;
}

interface EditTicketDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTicketDialog({ ticketId, open, onOpenChange, onSuccess }: EditTicketDialogProps) {
  const { user } = useAuth();
  const { reverseGeocode, isLoading: isGeocoding } = useGeocoding();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cliente');
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotoGroups, setNewPhotoGroups] = useState<PhotoToUploadGroup[]>([]);
  const [openMainAgent, setOpenMainAgent] = useState(false);
  const [openSupport1, setOpenSupport1] = useState(false);
  const [openSupport2, setOpenSupport2] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      status: 'aberto',
      client_id: '',
      vehicle_id: '',
      main_agent_id: '',
      support_agent_1_id: '',
      support_agent_1_arrival: '',
      support_agent_1_departure: '',
      support_agent_2_id: '',
      support_agent_2_arrival: '',
      support_agent_2_departure: '',
      plan_id: '',
      service_type: 'acompanhamento_logistico',
      city: '',
      state: '',
      start_datetime: '',
      end_datetime: '',
      coordinates_lat: null,
      coordinates_lng: null,
      support_agent_1_km_start: null,
      support_agent_1_km_end: null,
      support_agent_1_toll_cost: 0,
      support_agent_1_food_cost: 0,
      support_agent_1_other_costs: 0,
      support_agent_2_km_start: null,
      support_agent_2_km_end: null,
      support_agent_2_toll_cost: 0,
      support_agent_2_food_cost: 0,
      support_agent_2_other_costs: 0,
      km_start: null,
      km_end: null,
      toll_cost: 0,
      food_cost: 0,
      other_costs: 0,
      summary: '',
      detailed_report: '',
      operator_id: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const coordLat = form.watch('coordinates_lat');
  const coordLng = form.watch('coordinates_lng');

  // Main Agent Calculations
  const kmStart = form.watch('km_start');
  const kmEnd = form.watch('km_end');
  const kmRodado = kmStart && kmEnd && kmEnd >= kmStart ? kmEnd - kmStart : 0;
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  const totalCost = tollCost + foodCost + otherCosts;

  // Support 1 Calculations
  const s1KmStart = form.watch('support_agent_1_km_start');
  const s1KmEnd = form.watch('support_agent_1_km_end');
  const s1KmRodado = s1KmStart && s1KmEnd && s1KmEnd >= s1KmStart ? s1KmEnd - s1KmStart : 0;
  const s1Toll = form.watch('support_agent_1_toll_cost') || 0;
  const s1Food = form.watch('support_agent_1_food_cost') || 0;
  const s1Other = form.watch('support_agent_1_other_costs') || 0;
  const s1TotalCost = s1Toll + s1Food + s1Other;

  // Support 2 Calculations
  const s2KmStart = form.watch('support_agent_2_km_start');
  const s2KmEnd = form.watch('support_agent_2_km_end');
  const s2KmRodado = s2KmStart && s2KmEnd && s2KmEnd >= s2KmStart ? s2KmEnd - s2KmStart : 0;
  const s2Toll = form.watch('support_agent_2_toll_cost') || 0;
  const s2Food = form.watch('support_agent_2_food_cost') || 0;
  const s2Other = form.watch('support_agent_2_other_costs') || 0;
  const s2TotalCost = s2Toll + s2Food + s2Other;

  // Global Totals
  const totalKmGeral = kmRodado + s1KmRodado + s2KmRodado;
  const totalCustoGeral = totalCost + s1TotalCost + s2TotalCost;

  useEffect(() => {
    if (open) {
      fetchData();
      setActiveTab('cliente');
      setNewPhotoGroups([]);
    }
  }, [open]);

  useEffect(() => {
    if (ticketId && open && clients.length > 0) {
      fetchTicket();
      fetchPhotos();
    }
  }, [ticketId, open, clients.length]);


  useEffect(() => {
    if (selectedClientId) {
      setFilteredVehicles(vehicles.filter(v => v.client_id === selectedClientId));
    } else {
      setFilteredVehicles([]);
    }
  }, [selectedClientId, vehicles]);

  const fetchData = async () => {
    try {
      const [clientsRes, vehiclesRes, agentsRes, plansRes, operatorsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('vehicles').select('id, description, client_id'),
        supabase.from('agents').select('id, name, is_armed').eq('status', 'ativo').order('name'),
        supabase.from('plans').select('id, name').order('name'),
        (supabase.from('operators' as any) as any).select('id, name').eq('active', true).order('name'),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (plansRes.data) setPlans(plansRes.data);
      if (operatorsRes.data) setOperators(operatorsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const fetchTicket = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      if (data) {
        const ticket = data as any;
        form.reset({
          status: ticket.status,
          client_id: ticket.client_id,
          vehicle_id: ticket.vehicle_id,
          main_agent_id: ticket.main_agent_id,
          main_agent_arrival: ticket.main_agent_arrival ? new Date(ticket.main_agent_arrival).toISOString().slice(0, 16) : '',
          main_agent_departure: ticket.main_agent_departure ? new Date(ticket.main_agent_departure).toISOString().slice(0, 16) : '',
          support_agent_1_id: ticket.support_agent_1_id || '',
          support_agent_1_arrival: ticket.support_agent_1_arrival ? new Date(ticket.support_agent_1_arrival).toISOString().slice(0, 16) : '',
          support_agent_1_departure: ticket.support_agent_1_departure ? new Date(ticket.support_agent_1_departure).toISOString().slice(0, 16) : '',
          support_agent_1_km_start: ticket.support_agent_1_km_start || null,
          support_agent_1_km_end: ticket.support_agent_1_km_end || null,
          support_agent_1_toll_cost: ticket.support_agent_1_toll_cost || 0,
          support_agent_1_food_cost: ticket.support_agent_1_food_cost || 0,
          support_agent_1_other_costs: ticket.support_agent_1_other_costs || 0,
          support_agent_2_id: ticket.support_agent_2_id || '',
          support_agent_2_arrival: ticket.support_agent_2_arrival ? new Date(ticket.support_agent_2_arrival).toISOString().slice(0, 16) : '',
          support_agent_2_departure: ticket.support_agent_2_departure ? new Date(ticket.support_agent_2_departure).toISOString().slice(0, 16) : '',
          support_agent_2_km_start: ticket.support_agent_2_km_start || null,
          support_agent_2_km_end: ticket.support_agent_2_km_end || null,
          support_agent_2_toll_cost: ticket.support_agent_2_toll_cost || 0,
          support_agent_2_food_cost: ticket.support_agent_2_food_cost || 0,
          support_agent_2_other_costs: ticket.support_agent_2_other_costs || 0,
          plan_id: ticket.plan_id,
          service_type: ticket.service_type,
          city: ticket.city,
          state: ticket.state,
          start_datetime: ticket.start_datetime ? new Date(ticket.start_datetime).toISOString().slice(0, 16) : '',
          end_datetime: ticket.end_datetime ? new Date(ticket.end_datetime).toISOString().slice(0, 16) : '',
          coordinates_lat: ticket.coordinates_lat ? Number(ticket.coordinates_lat) : null,
          coordinates_lng: ticket.coordinates_lng ? Number(ticket.coordinates_lng) : null,
          km_start: ticket.km_start ? Number(ticket.km_start) : null,
          km_end: ticket.km_end ? Number(ticket.km_end) : null,
          toll_cost: ticket.toll_cost ? Number(ticket.toll_cost) : null,
          food_cost: ticket.food_cost ? Number(ticket.food_cost) : null,
          other_costs: ticket.other_costs ? Number(ticket.other_costs) : null,
          summary: ticket.summary || '',
          detailed_report: ticket.detailed_report || '',
          operator_id: ticket.operator_id || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar chamado:', error);
      toast.error('Erro ao carregar dados do chamado');
    }
  };

  const fetchPhotos = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('ticket_photos')
        .select('id, file_url, caption')
        .eq('ticket_id', ticketId)
        .order('created_at');

      if (error) throw error;
      setExistingPhotos(data || []);
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
    }
  };

  const handlePhotoDelete = async (photoId: string, fileUrl: string) => {
    try {
      const fileName = fileUrl.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('ticket-photos')
          .remove([`${ticketId}/${fileName}`]);
      }

      const { error } = await supabase
        .from('ticket_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Foto removida com sucesso');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('coordinates_lat', position.coords.latitude);
        form.setValue('coordinates_lng', position.coords.longitude);
        toast.success('Localização capturada');
      },
      () => toast.error('Erro ao obter localização')
    );
  };

  const handleReverseGeocode = async () => {
    const lat = form.getValues('coordinates_lat');
    const lng = form.getValues('coordinates_lng');

    if (!lat || !lng) {
      toast.error('Informe as coordenadas primeiro');
      return;
    }

    const result = await reverseGeocode(lat, lng);
    if (result) {
      form.setValue('city', result.city);
      form.setValue('state', result.state);
      toast.success('Cidade e estado preenchidos!');
    }
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setNewPhotoGroups(prev => {
      const updated = [...prev];
      let remaining = [...newFiles];

      if (updated.length > 0) {
        const lastGroup = updated[updated.length - 1];
        if (lastGroup.files.length < 4) {
          const spotsAvailable = 4 - lastGroup.files.length;
          const toAdd = remaining.splice(0, spotsAvailable);
          updated[updated.length - 1] = {
            ...lastGroup,
            files: [...lastGroup.files, ...toAdd],
          };
        }
      }

      while (remaining.length > 0) {
        updated.push({ files: remaining.splice(0, 4), caption: '' });
      }
      return updated;
    });

    e.target.value = '';
  };

  const removeNewPhoto = (groupIndex: number, photoIndex: number) => {
    setNewPhotoGroups(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[groupIndex].files[photoIndex].preview);
      updated[groupIndex] = {
        ...updated[groupIndex],
        files: updated[groupIndex].files.filter((_, i) => i !== photoIndex),
      };
      return updated.filter(g => g.files.length > 0);
    });
  };

  const updateNewPhotoCaption = (groupIndex: number, caption: string) => {
    setNewPhotoGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, caption } : g));
  };

  const uploadNewPhotos = async () => {
    if (!ticketId || !user || newPhotoGroups.length === 0) return;

    for (const group of newPhotoGroups) {
      for (const photo of group.files) {
        const fileName = `${ticketId}/${Date.now()}-${photo.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('ticket-photos')
          .upload(fileName, photo.file);

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('ticket-photos')
          .getPublicUrl(fileName);

        await supabase.from('ticket_photos').insert({
          ticket_id: ticketId,
          file_url: urlData.publicUrl,
          caption: group.caption || null,
          uploaded_by_user_id: user.id,
        });
      }
    }
  };

  const validateBusinessRules = (data: TicketFormData): boolean => {
    if (data.km_start && data.km_end && data.km_end < data.km_start) {
      toast.error('KM Final deve ser maior ou igual ao KM Inicial');
      return false;
    }

    if (data.start_datetime && data.end_datetime) {
      const start = new Date(data.start_datetime);
      const end = new Date(data.end_datetime);
      if (end < start) {
        toast.error('Data/hora final deve ser posterior à data/hora inicial');
        return false;
      }
    }

    return true;
  };

  const onSubmit = async (data: TicketFormData) => {
    if (!ticketId) return;

    if (!validateBusinessRules(data)) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: data.status,
          client_id: data.client_id,
          vehicle_id: data.vehicle_id,
          main_agent_id: data.main_agent_id,
          main_agent_arrival: data.main_agent_arrival || null,
          main_agent_departure: data.main_agent_departure || null,
          support_agent_1_id: data.support_agent_1_id && data.support_agent_1_id !== 'none' ? data.support_agent_1_id : null,
          support_agent_1_arrival: data.support_agent_1_arrival || null,
          support_agent_1_departure: data.support_agent_1_departure || null,
          support_agent_1_km_start: data.support_agent_1_km_start || null,
          support_agent_1_km_end: data.support_agent_1_km_end || null,
          support_agent_1_toll_cost: data.support_agent_1_toll_cost || 0,
          support_agent_1_food_cost: data.support_agent_1_food_cost || 0,
          support_agent_1_other_costs: data.support_agent_1_other_costs || 0,
          support_agent_2_id: data.support_agent_2_id && data.support_agent_2_id !== 'none' ? data.support_agent_2_id : null,
          support_agent_2_arrival: data.support_agent_2_arrival || null,
          support_agent_2_departure: data.support_agent_2_departure || null,
          support_agent_2_km_start: data.support_agent_2_km_start || null,
          support_agent_2_km_end: data.support_agent_2_km_end || null,
          support_agent_2_toll_cost: data.support_agent_2_toll_cost || 0,
          support_agent_2_food_cost: data.support_agent_2_food_cost || 0,
          support_agent_2_other_costs: data.support_agent_2_other_costs || 0,
          plan_id: data.plan_id,
          service_type: data.service_type,
          city: data.city,
          state: data.state,
          start_datetime: data.main_agent_arrival || data.start_datetime,
          end_datetime: data.main_agent_departure || data.end_datetime || null,
          coordinates_lat: data.coordinates_lat || null,
          coordinates_lng: data.coordinates_lng || null,
          km_start: data.km_start || null,
          km_end: data.km_end || null,
          toll_cost: data.toll_cost || 0,
          food_cost: data.food_cost || 0,
          other_costs: data.other_costs || 0,
          summary: data.summary || null,
          detailed_report: data.detailed_report || null,
          operator_id: data.operator_id && data.operator_id !== 'none' ? data.operator_id : null,
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Upload new photos
      if (newPhotoGroups.length > 0) {
        await uploadNewPhotos();
      }

      toast.success('Chamado atualizado com sucesso!');
      newPhotoGroups.forEach(g => g.files.forEach(p => URL.revokeObjectURL(p.preview)));
      setNewPhotoGroups([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar chamado:', error);
      toast.error('Erro ao atualizar chamado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Chamado</DialogTitle>
            <DialogDescription>Atualize os dados do chamado</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cliente">Cliente</TabsTrigger>
                    <TabsTrigger value="agente">Agente/Despesas</TabsTrigger>
                    <TabsTrigger value="fotos">Fotos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="cliente" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="aberto">Aberto</SelectItem>
                              <SelectItem value="em_andamento">Em Andamento</SelectItem>
                              <SelectItem value="finalizado">Finalizado</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vehicle_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Veículo *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClientId}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={selectedClientId ? "Selecione o veículo" : "Selecione um cliente primeiro"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredVehicles.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="plan_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plano *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o plano" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="service_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Serviço *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="alarme">Alarme</SelectItem>
                                <SelectItem value="averiguacao">Averiguação</SelectItem>
                                <SelectItem value="preservacao">Preservação</SelectItem>
                                <SelectItem value="acompanhamento_logistico">Acompanhamento Logístico</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade *</FormLabel>
                            <FormControl>
                              <Input placeholder="Cidade" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado *</FormLabel>
                            <FormControl>
                              <Input placeholder="UF" maxLength={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>


                    <div className="space-y-2">
                      <Label>Coordenadas</Label>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name="coordinates_lat"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="Latitude"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="coordinates_lng"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="Longitude"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={getLocation} title="Localização atual">
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleReverseGeocode}
                          disabled={!coordLat || !coordLng || isGeocoding}
                          title="Buscar cidade/estado"
                        >
                          {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="agente" className="space-y-6 mt-4">
                    {/* Operador Responsável */}
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                      <FormField
                        control={form.control}
                        name="operator_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-primary flex items-center gap-2">
                              OPERADOR RESPONSÁVEL
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecione o operador" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Selecione...</SelectItem>
                                {operators.map((operator) => (
                                  <SelectItem key={operator.id} value={operator.id}>
                                    {operator.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      {/* Agente Principal */}
                      <div className="space-y-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-primary uppercase tracking-wider">Agente Principal</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => setIsMapDialogOpen(true)}
                          >
                            <MapPin className="h-3 w-3" />
                            BUSCA POR MAPA
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="main_agent_id"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-xs">Identificação do Agente</FormLabel>
                                <Popover open={openMainAgent} onOpenChange={setOpenMainAgent}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openMainAgent}
                                        className={cn(
                                          "w-full justify-between font-normal h-9 text-xs",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? agents.find((agent) => agent.id === field.value)?.name
                                          : "Selecione o agente de campo"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Pesquisar agente..." />
                                      <CommandList>
                                        <CommandEmpty>Nenhum agente encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          {agents.map((agent) => (
                                            <CommandItem
                                              key={agent.id}
                                              value={agent.name}
                                              onSelect={() => {
                                                form.setValue("main_agent_id", agent.id);
                                                setOpenMainAgent(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  agent.id === field.value ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div>
                            <Label className="text-xs">Veículo da Operação</Label>
                            <Input
                              value={filteredVehicles.find(v => v.id === form.watch('vehicle_id'))?.description || 'Selecione no menu Cliente'}
                              disabled
                              className="mt-1 h-9 bg-muted text-xs font-medium"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <FormField
                            control={form.control}
                            name="main_agent_arrival"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Chegada</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="main_agent_departure"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Saída</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                          <FormField
                            control={form.control}
                            name="km_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Inicial</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="km_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Final</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">KM Rodado</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold text-primary">
                              {kmRodado} km
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name="toll_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Pedágio (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="food_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Alimentação (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="other_costs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Outros (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Total Agente</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm border-b pb-2 text-muted-foreground mt-4">AGENTE(S) DE APOIO</h4>

                      {/* Apoio 1 */}
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Apoio Secundário (1)</h5>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name="support_agent_1_id"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-xs">Agente</FormLabel>
                                <Popover open={openSupport1} onOpenChange={setOpenSupport1}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openSupport1}
                                        className={cn(
                                          "w-full justify-between font-normal h-9 text-xs",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value && field.value !== "none"
                                          ? agents.find((agent) => agent.id === field.value)?.name
                                          : "Selecione"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Pesquisar..." />
                                      <CommandList>
                                        <CommandEmpty>Não encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="none"
                                            onSelect={() => {
                                              form.setValue("support_agent_1_id", "");
                                              setOpenSupport1(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                !field.value || field.value === "none" ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            Nenhum
                                          </CommandItem>
                                          {agents.map((agent) => (
                                            <CommandItem
                                              key={agent.id}
                                              value={agent.name}
                                              onSelect={() => {
                                                form.setValue("support_agent_1_id", agent.id);
                                                setOpenSupport1(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  agent.id === field.value ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {agent.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_1_arrival"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Chegada</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_1_departure"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Saída</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                          <FormField
                            control={form.control}
                            name="support_agent_1_km_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Inicial</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_1_km_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Final</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">KM Rodado</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {s1KmRodado} km
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name="support_agent_1_toll_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Pedágio (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_1_food_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Alimentação (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_1_other_costs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Outros (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Total Apoio 1</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {s1TotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Apoio 2 */}
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <h5 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Apoio Terceiro (2)</h5>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name="support_agent_2_id"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-xs">Agente</FormLabel>
                                <Popover open={openSupport2} onOpenChange={setOpenSupport2}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openSupport2}
                                        className={cn(
                                          "w-full justify-between font-normal h-9 text-xs",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value && field.value !== "none"
                                          ? agents.find((agent) => agent.id === field.value)?.name
                                          : "Selecione"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Pesquisar..." />
                                      <CommandList>
                                        <CommandEmpty>Não encontrado.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="none"
                                            onSelect={() => {
                                              form.setValue("support_agent_2_id", "");
                                              setOpenSupport2(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                !field.value || field.value === "none" ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            Nenhum
                                          </CommandItem>
                                          {agents.map((agent) => (
                                            <CommandItem
                                              key={agent.id}
                                              value={agent.name}
                                              onSelect={() => {
                                                form.setValue("support_agent_2_id", agent.id);
                                                setOpenSupport2(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  agent.id === field.value ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {agent.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_2_arrival"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Chegada</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_2_departure"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Saída</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" className="h-9 text-xs" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                          <FormField
                            control={form.control}
                            name="support_agent_2_km_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Inicial</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_2_km_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">KM Final</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">KM Rodado</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {s2KmRodado} km
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name="support_agent_2_toll_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Pedágio (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_2_food_cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Alimentação (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="support_agent_2_other_costs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Outros (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    {...field}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Total Apoio 2</Label>
                            <div className="h-8 flex items-center px-3 rounded-md border bg-muted/50 text-xs font-bold">
                              {s2TotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo Geral da Operação */}
                    <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/30 space-y-3">
                      <h4 className="font-bold text-sm text-secondary uppercase tracking-wider">Resumo Geral da Operação</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-md border shadow-sm">
                          <Label className="text-xs text-muted-foreground">KM TOTAL RODADO (EQUIPE)</Label>
                          <div className="text-2xl font-black text-primary">
                            {totalKmGeral} <span className="text-sm">km</span>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-md border shadow-sm">
                          <Label className="text-xs text-muted-foreground">CUSTO TOTAL DA OPERAÇÃO</Label>
                          <div className="text-2xl font-black text-success">
                            {totalCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Descrição do Evento */}
                    <div className="space-y-4 pt-4 border-t">
                      <FormField
                        control={form.control}
                        name="detailed_report"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição do Evento</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Relatório detalhado do atendimento..."
                                className="resize-none min-h-[100px]"
                                rows={6}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="fotos" className="space-y-4 mt-4">
                    {/* Existing photos */}
                    {existingPhotos.length > 0 && (
                      <div className="space-y-2">
                        <Label className="font-medium">Fotos já anexadas</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {existingPhotos.map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.file_url}
                                alt={photo.caption || 'Foto do chamado'}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handlePhotoDelete(photo.id, photo.file_url)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              {photo.caption && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upload area */}
                    <div className="space-y-2">
                      <Label className="font-medium">Adicionar novas fotos</Label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          id="photo-upload-edit"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoAdd}
                          className="hidden"
                        />
                        <label htmlFor="photo-upload-edit" className="cursor-pointer">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex gap-2">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <Camera className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Clique para selecionar fotos ou usar a câmera
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* New photos preview */}
                    {newPhotoGroups.length > 0 && (
                      <div className="space-y-4">
                        <Label className="font-medium">Novas fotos ({newPhotoGroups.reduce((acc, g) => acc + g.files.length, 0)})</Label>
                        {newPhotoGroups.map((group, groupIndex) => (
                          <div key={groupIndex} className="border border-border rounded-lg p-4 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              Grupo {groupIndex + 1} — {group.files.length} foto{group.files.length !== 1 ? 's' : ''}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {group.files.map((photo, photoIndex) => (
                                <div key={photoIndex} className="relative aspect-[4/3]">
                                  <img
                                    src={photo.preview}
                                    alt={`Foto ${photoIndex + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeNewPhoto(groupIndex, photoIndex)}
                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div>
                              <Label htmlFor={`edit-group-caption-${groupIndex}`} className="text-xs">
                                Descrição do grupo (opcional)
                              </Label>
                              <Textarea
                                id={`edit-group-caption-${groupIndex}`}
                                placeholder="Descreva este grupo de fotos..."
                                value={group.caption}
                                onChange={(e) => updateNewPhotoCaption(groupIndex, e.target.value)}
                                className="mt-1 resize-none"
                                rows={2}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Selecionar Agente no Mapa
            </DialogTitle>
            <DialogDescription>
              Localize os agentes ativos no mapa e selecione o mais próximo do local do chamado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4">
            <AgentMap
              onSelect={(agentId) => {
                form.setValue('main_agent_id', agentId);
                setIsMapDialogOpen(false);
                toast.success("Agente selecionado no mapa!");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
