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
import { MapPin, Search, Loader2, Upload, X, Camera } from 'lucide-react';

const ticketSchema = z.object({
  status: z.enum(['aberto', 'em_andamento', 'finalizado', 'cancelado']),
  client_id: z.string().min(1, 'Cliente é obrigatório'),
  vehicle_id: z.string().min(1, 'Veículo é obrigatório'),
  main_agent_id: z.string().min(1, 'Agente é obrigatório'),
  support_agent_1_id: z.string().optional(),
  support_agent_1_arrival: z.string().optional(),
  support_agent_1_departure: z.string().optional(),
  support_agent_2_id: z.string().optional(),
  support_agent_2_arrival: z.string().optional(),
  support_agent_2_departure: z.string().optional(),
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

interface ExistingPhoto {
  id: string;
  file_url: string;
  caption: string | null;
}

interface PhotoToUpload {
  file: File;
  preview: string;
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
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoToUpload[]>([]);

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
      km_start: null,
      km_end: null,
      toll_cost: null,
      food_cost: null,
      other_costs: null,
      summary: '',
      detailed_report: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const coordLat = form.watch('coordinates_lat');
  const coordLng = form.watch('coordinates_lng');
  const kmStart = form.watch('km_start');
  const kmEnd = form.watch('km_end');
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  
  const kmRodado = kmStart && kmEnd && kmEnd >= kmStart ? kmEnd - kmStart : null;
  const totalCost = tollCost + foodCost + otherCosts;

  useEffect(() => {
    if (open) {
      fetchData();
      setActiveTab('cliente');
      setNewPhotos([]);
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
      const [clientsRes, vehiclesRes, agentsRes, plansRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('vehicles').select('id, description, client_id'),
        supabase.from('agents').select('id, name, is_armed').eq('status', 'ativo').order('name'),
        supabase.from('plans').select('id, name').order('name'),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (plansRes.data) setPlans(plansRes.data);
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
        form.reset({
          status: data.status,
          client_id: data.client_id,
          vehicle_id: data.vehicle_id,
          main_agent_id: data.main_agent_id,
          support_agent_1_id: data.support_agent_1_id || '',
          support_agent_1_arrival: data.support_agent_1_arrival ? new Date(data.support_agent_1_arrival).toISOString().slice(0, 16) : '',
          support_agent_1_departure: data.support_agent_1_departure ? new Date(data.support_agent_1_departure).toISOString().slice(0, 16) : '',
          support_agent_2_id: data.support_agent_2_id || '',
          support_agent_2_arrival: data.support_agent_2_arrival ? new Date(data.support_agent_2_arrival).toISOString().slice(0, 16) : '',
          support_agent_2_departure: data.support_agent_2_departure ? new Date(data.support_agent_2_departure).toISOString().slice(0, 16) : '',
          plan_id: data.plan_id,
          service_type: data.service_type,
          city: data.city,
          state: data.state,
          start_datetime: data.start_datetime ? new Date(data.start_datetime).toISOString().slice(0, 16) : '',
          end_datetime: data.end_datetime ? new Date(data.end_datetime).toISOString().slice(0, 16) : '',
          coordinates_lat: data.coordinates_lat ? Number(data.coordinates_lat) : null,
          coordinates_lng: data.coordinates_lng ? Number(data.coordinates_lng) : null,
          km_start: data.km_start ? Number(data.km_start) : null,
          km_end: data.km_end ? Number(data.km_end) : null,
          toll_cost: data.toll_cost ? Number(data.toll_cost) : null,
          food_cost: data.food_cost ? Number(data.food_cost) : null,
          other_costs: data.other_costs ? Number(data.other_costs) : null,
          summary: data.summary || '',
          detailed_report: data.detailed_report || '',
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
    if (files) {
      const newPhotosList: PhotoToUpload[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
      }));
      setNewPhotos(prev => [...prev, ...newPhotosList]);
    }
    e.target.value = '';
  };

  const removeNewPhoto = (index: number) => {
    URL.revokeObjectURL(newPhotos[index].preview);
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateNewPhotoCaption = (index: number, caption: string) => {
    setNewPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, caption } : photo
    ));
  };

  const uploadNewPhotos = async () => {
    if (!ticketId || !user || newPhotos.length === 0) return;

    for (const photo of newPhotos) {
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
        caption: photo.caption || null,
        uploaded_by_user_id: user.id,
      });
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
          support_agent_1_id: data.support_agent_1_id || null,
          support_agent_1_arrival: data.support_agent_1_arrival || null,
          support_agent_1_departure: data.support_agent_1_departure || null,
          support_agent_2_id: data.support_agent_2_id || null,
          support_agent_2_arrival: data.support_agent_2_arrival || null,
          support_agent_2_departure: data.support_agent_2_departure || null,
          plan_id: data.plan_id,
          service_type: data.service_type,
          city: data.city,
          state: data.state,
          start_datetime: data.start_datetime,
          end_datetime: data.end_datetime || null,
          coordinates_lat: data.coordinates_lat || null,
          coordinates_lng: data.coordinates_lng || null,
          km_start: data.km_start || null,
          km_end: data.km_end || null,
          toll_cost: data.toll_cost || null,
          food_cost: data.food_cost || null,
          other_costs: data.other_costs || null,
          summary: data.summary || null,
          detailed_report: data.detailed_report || null,
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Upload new photos
      if (newPhotos.length > 0) {
        await uploadNewPhotos();
      }

      toast.success('Chamado atualizado com sucesso!');
      newPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setNewPhotos([]);
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_datetime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data/Hora Início *</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="end_datetime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data/Hora Fim</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
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

                <TabsContent value="agente" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="main_agent_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agente Principal *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o agente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Apoio 1 */}
                  <div className="space-y-2 p-3 border rounded-lg">
                    <Label className="font-medium">Apoio 1</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="support_agent_1_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Agente</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Nenhum</SelectItem>
                                {agents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                              <Input type="datetime-local" {...field} />
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
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Apoio 2 */}
                  <div className="space-y-2 p-3 border rounded-lg">
                    <Label className="font-medium">Apoio 2</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="support_agent_2_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Agente</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Nenhum</SelectItem>
                                {agents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                              <Input type="datetime-local" {...field} />
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
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Quilometragem */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="km_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>KM Inicial</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              value={field.value || ''}
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
                          <FormLabel>KM Final</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>KM Rodado</Label>
                      <Input 
                        type="text" 
                        value={kmRodado !== null ? `${kmRodado} km` : '-'} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  {/* Despesas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="toll_cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pedágio (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0,00" 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
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
                          <FormLabel>Alimentação (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0,00" 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
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
                          <FormLabel>Outros (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0,00" 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>Total (R$)</Label>
                      <Input 
                        type="text" 
                        value={`R$ ${totalCost.toFixed(2).replace('.', ',')}`} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="detailed_report"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relatório Detalhado</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Relatório detalhado do atendimento..."
                            className="resize-none"
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="fotos" className="space-y-4 mt-4">
                  {/* Existing photos */}
                  {existingPhotos.length > 0 && (
                    <div className="space-y-2">
                      <Label className="font-medium">Fotos já anexadas</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {existingPhotos.map((photo) => (
                          <div key={photo.id} className="relative">
                            <img
                              src={photo.file_url}
                              alt={photo.caption || 'Foto do chamado'}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
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
                  {newPhotos.length > 0 && (
                    <div className="space-y-3">
                      <Label className="font-medium">Novas fotos ({newPhotos.length})</Label>
                      {newPhotos.map((photo, index) => (
                        <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                          <div className="relative">
                            <img
                              src={photo.preview}
                              alt={`Preview ${index + 1}`}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => removeNewPhoto(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1">
                            <Input
                              placeholder="Legenda da foto (opcional)"
                              value={photo.caption}
                              onChange={(e) => updateNewPhotoCaption(index, e.target.value)}
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
  );
}
