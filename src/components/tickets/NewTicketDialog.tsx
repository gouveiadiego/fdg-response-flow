import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { toast } from 'sonner';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MapPin, Upload, X, Camera, Search, Loader2 } from 'lucide-react';

const ticketSchema = z.object({
  client_id: z.string().min(1, 'Selecione um cliente'),
  vehicle_id: z.string().min(1, 'Selecione um veículo'),
  plan_id: z.string().min(1, 'Selecione um plano'),
  service_type: z.enum(['alarme', 'averiguacao', 'preservacao', 'acompanhamento_logistico']),
  main_agent_id: z.string().min(1, 'Selecione um agente'),
  support_agent_1_id: z.string().optional(),
  support_agent_1_arrival: z.string().optional(),
  support_agent_1_departure: z.string().optional(),
  support_agent_2_id: z.string().optional(),
  support_agent_2_arrival: z.string().optional(),
  support_agent_2_departure: z.string().optional(),
  city: z.string().min(1, 'Informe a cidade'),
  state: z.string().min(2, 'Informe o estado').max(2),
  start_datetime: z.string().min(1, 'Informe a data/hora inicial'),
  end_datetime: z.string().optional(),
  coordinates_lat: z.number().optional(),
  coordinates_lng: z.number().optional(),
  km_start: z.number().optional(),
  km_end: z.number().optional(),
  toll_cost: z.number().optional(),
  food_cost: z.number().optional(),
  other_costs: z.number().optional(),
  summary: z.string().max(500).optional(),
  detailed_report: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface Client {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface Vehicle {
  id: string;
  description: string;
  plate_main: string;
  client_id: string;
}

interface Plan {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  is_armed: boolean | null;
}

interface PhotoToUpload {
  file: File;
  preview: string;
  caption: string;
}

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SERVICE_TYPE_LABELS = {
  alarme: 'Alarme',
  averiguacao: 'Averiguação',
  preservacao: 'Preservação',
  acompanhamento_logistico: 'Acompanhamento Logístico',
};

export function NewTicketDialog({ open, onOpenChange, onSuccess }: NewTicketDialogProps) {
  const { user } = useAuth();
  const { reverseGeocode, isLoading: isGeocoding } = useGeocoding();
  const [activeTab, setActiveTab] = useState('cliente');
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [photos, setPhotos] = useState<PhotoToUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      client_id: '',
      vehicle_id: '',
      plan_id: '',
      service_type: 'acompanhamento_logistico',
      main_agent_id: '',
      support_agent_1_id: '',
      support_agent_1_arrival: '',
      support_agent_1_departure: '',
      support_agent_2_id: '',
      support_agent_2_arrival: '',
      support_agent_2_departure: '',
      city: '',
      state: '',
      start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: '',
      coordinates_lat: undefined,
      coordinates_lng: undefined,
      km_start: undefined,
      km_end: undefined,
      toll_cost: 0,
      food_cost: 0,
      other_costs: 0,
      summary: '',
      detailed_report: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const selectedVehicleId = form.watch('vehicle_id');
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  const totalCost = tollCost + foodCost + otherCosts;
  const coordLat = form.watch('coordinates_lat');
  const coordLng = form.watch('coordinates_lng');
  const kmStart = form.watch('km_start') || 0;
  const kmEnd = form.watch('km_end') || 0;
  const kmRodado = kmEnd >= kmStart && kmStart > 0 ? kmEnd - kmStart : null;
  
  const selectedVehicle = filteredVehicles.find(v => v.id === selectedVehicleId);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedClientId) {
      const clientVehicles = vehicles.filter(v => v.client_id === selectedClientId);
      setFilteredVehicles(clientVehicles);
      
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        form.setValue('city', selectedClient.city);
        form.setValue('state', selectedClient.state);
      }
      
      const currentVehicle = form.getValues('vehicle_id');
      if (currentVehicle && !clientVehicles.some(v => v.id === currentVehicle)) {
        form.setValue('vehicle_id', '');
      }
    } else {
      setFilteredVehicles([]);
    }
  }, [selectedClientId, vehicles, clients]);

  const fetchData = async () => {
    try {
      const [clientsRes, vehiclesRes, plansRes, agentsRes] = await Promise.all([
        supabase.from('clients').select('id, name, city, state').order('name'),
        supabase.from('vehicles').select('id, description, plate_main, client_id'),
        supabase.from('plans').select('id, name').order('name'),
        supabase.from('agents').select('id, name, is_armed').eq('status', 'ativo').order('name'),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (plansRes.data) setPlans(plansRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('coordinates_lat', position.coords.latitude);
        form.setValue('coordinates_lng', position.coords.longitude);
        toast.success('Localização capturada com sucesso');
      },
      (error) => {
        toast.error('Erro ao obter localização');
        console.error(error);
      }
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
      const newPhotos: PhotoToUpload[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, caption } : photo
    ));
  };

  const uploadPhotos = async (ticketId: string) => {
    const uploadedPhotos: Array<{ url: string; caption: string }> = [];
    
    for (const photo of photos) {
      const fileName = `${ticketId}/${Date.now()}-${photo.file.name}`;
      const { error } = await supabase.storage
        .from('ticket-photos')
        .upload(fileName, photo.file);
      
      if (error) {
        console.error('Erro ao fazer upload:', error);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('ticket-photos')
        .getPublicUrl(fileName);
      
      uploadedPhotos.push({ url: urlData.publicUrl, caption: photo.caption });
    }
    
    return uploadedPhotos;
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
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!validateBusinessRules(data)) return;

    setIsSubmitting(true);
    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          client_id: data.client_id,
          vehicle_id: data.vehicle_id,
          plan_id: data.plan_id,
          service_type: data.service_type,
          main_agent_id: data.main_agent_id,
          support_agent_1_id: data.support_agent_1_id || null,
          support_agent_1_arrival: data.support_agent_1_arrival || null,
          support_agent_1_departure: data.support_agent_1_departure || null,
          support_agent_2_id: data.support_agent_2_id || null,
          support_agent_2_arrival: data.support_agent_2_arrival || null,
          support_agent_2_departure: data.support_agent_2_departure || null,
          city: data.city,
          state: data.state,
          start_datetime: data.start_datetime,
          end_datetime: data.end_datetime || null,
          coordinates_lat: data.coordinates_lat,
          coordinates_lng: data.coordinates_lng,
          km_start: data.km_start,
          km_end: data.km_end,
          toll_cost: data.toll_cost,
          food_cost: data.food_cost,
          other_costs: data.other_costs,
          summary: data.summary || null,
          detailed_report: data.detailed_report,
          created_by_user_id: user.id,
          code: '',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (photos.length > 0 && ticket) {
        const uploadedPhotos = await uploadPhotos(ticket.id);
        
        for (const photo of uploadedPhotos) {
          await supabase.from('ticket_photos').insert({
            ticket_id: ticket.id,
            file_url: photo.url,
            caption: photo.caption || null,
            uploaded_by_user_id: user.id,
          });
        }
      }

      toast.success('Chamado criado com sucesso!');
      form.reset();
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setActiveTab('cliente');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      toast.error('Erro ao criar chamado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNextTab = () => {
    if (activeTab === 'cliente') setActiveTab('agente');
    else if (activeTab === 'agente') setActiveTab('fotos');
  };

  const goToPrevTab = () => {
    if (activeTab === 'fotos') setActiveTab('agente');
    else if (activeTab === 'agente') setActiveTab('cliente');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamado</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo chamado
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cliente">Cliente</TabsTrigger>
                <TabsTrigger value="agente">Agente/Despesas</TabsTrigger>
                <TabsTrigger value="fotos">Fotos</TabsTrigger>
              </TabsList>

              <TabsContent value="cliente" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedClientId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedClientId ? "Selecione o veículo" : "Selecione um cliente primeiro"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredVehicles.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                {vehicle.description} - {vehicle.plate_main}
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
                            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
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
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: São Paulo" {...field} />
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
                          <Input placeholder="Ex: SP" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="start_datetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data/Hora Inicial *</FormLabel>
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
                        <FormLabel>Data/Hora Final</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
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
                                onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
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
                                onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
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

                <div className="flex justify-end">
                  <Button type="button" onClick={goToNextTab}>
                    Próximo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="agente" className="space-y-6 mt-4">
                {/* Agente Principal e Veículo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
                    <Label>Veículo Selecionado</Label>
                    <Input 
                      value={selectedVehicle ? `${selectedVehicle.description} - ${selectedVehicle.plate_main}` : 'Selecione um veículo na aba Cliente'}
                      disabled
                      className="mt-2 bg-muted"
                    />
                  </div>
                </div>

                {/* Seção Apoios */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Apoios</h4>
                  
                  {/* Apoio 1 */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <Label className="font-medium">Apoio 1</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                    {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
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
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <Label className="font-medium">Apoio 2</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                    {agent.name} {agent.is_armed ? '(Armado)' : '(Desarmado)'}
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
                </div>

                {/* Seção Quilometragem */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Quilometragem</h4>
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
                              placeholder="Ex: 150000"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
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
                              placeholder="Ex: 150250"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>KM Rodado</Label>
                      <Input 
                        value={kmRodado !== null ? `${kmRodado} km` : '-'}
                        disabled
                        className="mt-2 bg-muted font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Despesas */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Despesas</h4>
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
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
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
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
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
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label>Total</Label>
                      <Input 
                        value={`R$ ${totalCost.toFixed(2)}`}
                        disabled
                        className="mt-2 bg-muted font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Resumo e Descrição */}
                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resumo (opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Breve resumo do atendimento..."
                          maxLength={500}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="detailed_report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Evento</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva os detalhes do atendimento..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={goToPrevTab}>
                    Anterior
                  </Button>
                  <Button type="button" onClick={goToNextTab}>
                    Próximo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="fotos" className="space-y-4 mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <Camera className="h-12 w-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Arraste fotos ou clique para selecionar
                      </p>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoAdd}
                        className="hidden"
                        id="photo-upload"
                      />
                      <Label htmlFor="photo-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Selecionar Fotos
                          </span>
                        </Button>
                      </Label>
                    </div>
                  </div>
                </div>

                {photos.length > 0 && (
                  <div className="space-y-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="flex gap-4 p-4 border border-border rounded-lg">
                        <div className="relative flex-shrink-0">
                          <img
                            src={photo.preview}
                            alt={`Foto ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Legenda (opcional)</Label>
                          <Input
                            placeholder="Descreva esta foto..."
                            value={photo.caption}
                            onChange={(e) => updateCaption(index, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={goToPrevTab}>
                    Anterior
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Criando...' : 'Criar Chamado'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
