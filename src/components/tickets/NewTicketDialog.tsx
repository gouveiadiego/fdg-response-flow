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
import { AgentMap } from '@/components/agents/AgentMap';
import { MapPin, Upload, X, Camera, Search, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const ticketSchema = z.object({
  client_id: z.string().min(1, 'Selecione um cliente'),
  vehicle_id: z.string().min(1, 'Selecione um veículo'),
  plan_id: z.string().min(1, 'Selecione um plano'),
  service_type: z.enum(['alarme', 'averiguacao', 'preservacao', 'acompanhamento_logistico']),
  main_agent_id: z.string().min(1, 'Selecione um agente'),
  main_agent_arrival: z.string().optional(),
  main_agent_departure: z.string().optional(),
  support_agent_1_id: z.string().optional(),
  support_agent_1_arrival: z.string().optional(),
  support_agent_1_departure: z.string().optional(),
  support_agent_1_km_start: z.number().optional(),
  support_agent_1_km_end: z.number().optional(),
  support_agent_1_toll_cost: z.number().optional(),
  support_agent_1_food_cost: z.number().optional(),
  support_agent_1_other_costs: z.number().optional(),
  support_agent_2_id: z.string().optional(),
  support_agent_2_arrival: z.string().optional(),
  support_agent_2_departure: z.string().optional(),
  support_agent_2_km_start: z.number().optional(),
  support_agent_2_km_end: z.number().optional(),
  support_agent_2_toll_cost: z.number().optional(),
  support_agent_2_food_cost: z.number().optional(),
  support_agent_2_other_costs: z.number().optional(),
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
  operator_id: z.string().optional(),
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

interface Operator {
  id: string;
  name: string;
}

interface PhotoGroup {
  files: { file: File; preview: string }[];
  caption: string;
}

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialAgentId?: string;
}

const SERVICE_TYPE_LABELS = {
  alarme: 'Alarme',
  averiguacao: 'Averiguação',
  preservacao: 'Preservação',
  acompanhamento_logistico: 'Acompanhamento Logístico',
};

export function NewTicketDialog({ open, onOpenChange, onSuccess, initialAgentId }: NewTicketDialogProps) {
  const { user } = useAuth();
  const { reverseGeocode, isLoading: isGeocoding } = useGeocoding();
  const [activeTab, setActiveTab] = useState('cliente');
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openAgent, setOpenAgent] = useState(false);
  const [openSupport1, setOpenSupport1] = useState(false);
  const [openSupport2, setOpenSupport2] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);

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
      support_agent_1_km_start: undefined,
      support_agent_1_km_end: undefined,
      support_agent_1_toll_cost: 0,
      support_agent_1_food_cost: 0,
      support_agent_1_other_costs: 0,
      support_agent_2_id: '',
      support_agent_2_arrival: '',
      support_agent_2_departure: '',
      support_agent_2_km_start: undefined,
      support_agent_2_km_end: undefined,
      support_agent_2_toll_cost: 0,
      support_agent_2_food_cost: 0,
      support_agent_2_other_costs: 0,
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
      operator_id: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const selectedVehicleId = form.watch('vehicle_id');

  // Main Agent Calculations
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  const totalCost = tollCost + foodCost + otherCosts;
  const kmStart = form.watch('km_start') || 0;
  const kmEnd = form.watch('km_end') || 0;
  const kmRodado = kmEnd >= kmStart && kmStart > 0 ? kmEnd - kmStart : 0;

  // Support 1 Calculations
  const s1Toll = form.watch('support_agent_1_toll_cost') || 0;
  const s1Food = form.watch('support_agent_1_food_cost') || 0;
  const s1Other = form.watch('support_agent_1_other_costs') || 0;
  const s1TotalCost = s1Toll + s1Food + s1Other;
  const s1KmStart = form.watch('support_agent_1_km_start') || 0;
  const s1KmEnd = form.watch('support_agent_1_km_end') || 0;
  const s1KmRodado = s1KmEnd >= s1KmStart && s1KmStart > 0 ? s1KmEnd - s1KmStart : 0;

  // Support 2 Calculations
  const s2Toll = form.watch('support_agent_2_toll_cost') || 0;
  const s2Food = form.watch('support_agent_2_food_cost') || 0;
  const s2Other = form.watch('support_agent_2_other_costs') || 0;
  const s2TotalCost = s2Toll + s2Food + s2Other;
  const s2KmStart = form.watch('support_agent_2_km_start') || 0;
  const s2KmEnd = form.watch('support_agent_2_km_end') || 0;
  const s2KmRodado = s2KmEnd >= s2KmStart && s2KmStart > 0 ? s2KmEnd - s2KmStart : 0;

  // Global Totals
  const totalKmGeral = kmRodado + s1KmRodado + s2KmRodado;
  const totalCustoGeral = totalCost + s1TotalCost + s2TotalCost;

  const coordLat = form.watch('coordinates_lat');
  const coordLng = form.watch('coordinates_lng');

  const selectedVehicle = filteredVehicles.find(v => v.id === selectedVehicleId);

  useEffect(() => {
    if (open) {
      fetchData();
      if (initialAgentId) {
        form.setValue('main_agent_id', initialAgentId);
      }
    }
  }, [open, initialAgentId]);

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
      const { data: clientsData } = await supabase.from('clients').select('id, name, city, state').order('name');
      const { data: vehiclesData } = await supabase.from('vehicles').select('id, description, plate_main, client_id');
      const { data: plansData } = await supabase.from('plans').select('id, name').order('name');
      const { data: agentsData } = await supabase.from('agents').select('id, name, is_armed').eq('status', 'ativo').order('name');

      // @ts-ignore - developers might be using a schema where operators is missing from generated types
      const { data: operatorsData } = await (supabase.from('operators' as any)
        .select('id, name')
        .eq('active', true)
        .order('name') as any);

      if (clientsData) setClients(clientsData);
      if (vehiclesData) setVehicles(vehiclesData);
      if (plansData) setPlans(plansData);
      if (agentsData) setAgents(agentsData);
      if (operatorsData) setOperators(operatorsData);
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
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotoGroups(prev => {
      const updated = [...prev];
      let remaining = [...newFiles];

      // Try to fill the last group if it has < 4 photos
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

      // Add remaining as new groups
      while (remaining.length > 0) {
        updated.push({ files: remaining.splice(0, 4), caption: '' });
      }
      return updated;
    });

    e.target.value = '';
  };

  const removePhoto = (groupIndex: number, photoIndex: number) => {
    setPhotoGroups(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[groupIndex].files[photoIndex].preview);
      updated[groupIndex] = {
        ...updated[groupIndex],
        files: updated[groupIndex].files.filter((_, i) => i !== photoIndex),
      };
      return updated.filter(g => g.files.length > 0);
    });
  };

  const updateGroupCaption = (groupIndex: number, caption: string) => {
    setPhotoGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, caption } : g));
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
          main_agent_arrival: data.main_agent_arrival || null,
          main_agent_departure: data.main_agent_departure || null,
          support_agent_1_id: data.support_agent_1_id && data.support_agent_1_id !== 'none' ? data.support_agent_1_id : null,
          support_agent_1_arrival: data.support_agent_1_arrival || null,
          support_agent_1_departure: data.support_agent_1_departure || null,
          support_agent_2_id: data.support_agent_2_id && data.support_agent_2_id !== 'none' ? data.support_agent_2_id : null,
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
          code: null,
          operator_id: data.operator_id && data.operator_id !== 'none' ? data.operator_id : null,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      if (photoGroups.length > 0 && ticket) {
        for (const group of photoGroups) {
          for (const photo of group.files) {
            const fileName = `${ticket.id}/${Date.now()}-${photo.file.name}`;
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
              ticket_id: ticket.id,
              file_url: urlData.publicUrl,
              caption: group.caption || null,
              uploaded_by_user_id: user.id,
            });
          }
        }
      }

      toast.success('Chamado criado com sucesso!');
      form.reset();
      photoGroups.forEach(g => g.files.forEach(p => URL.revokeObjectURL(p.preview)));
      setPhotoGroups([]);
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
    <>
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
                  {/* Operador Responsável */}
                  <div className="bg-muted/30 p-4 rounded-lg border border-muted">
                    <FormField
                      control={form.control}
                      name="operator_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operador Responsável (Quem abriu o chamado)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Agente Principal */}
                  <div className="space-y-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <h4 className="font-bold text-sm text-primary">Agente Principal</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary flex items-center gap-1 hover:bg-primary/10"
                        onClick={() => setIsMapDialogOpen(true)}
                      >
                        <MapPin className="h-3 w-3" />
                        Buscar no Mapa
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="main_agent_id"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-xs">Identificação do Agente *</FormLabel>
                            <Popover open={openAgent} onOpenChange={setOpenAgent}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openAgent}
                                    className={cn(
                                      "w-full justify-between font-normal h-9 text-xs",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value
                                      ? agents.find((agent) => agent.id === field.value)?.name
                                      : "Selecione o agente"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Pesquisar agente..." />
                                  <CommandList>
                                    <CommandEmpty>Agente não encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {agents.map((agent) => (
                                        <CommandItem
                                          key={agent.id}
                                          value={agent.name}
                                          onSelect={() => {
                                            form.setValue("main_agent_id", agent.id);
                                            setOpenAgent(false);
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
                        <Label className="text-xs">Veículo Selecionado</Label>
                        <Input
                          value={selectedVehicle ? `${selectedVehicle.description} - ${selectedVehicle.plate_main}` : 'Selecione no Cliente'}
                          disabled
                          className="mt-1 h-9 text-xs bg-muted/50"
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <FormField
                        control={form.control}
                        name="km_start"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">KM Inicial</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-8 text-xs"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                placeholder="0"
                                className="h-8 text-xs"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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

                  {/* Seção Apoios */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm border-b pb-2 text-muted-foreground">AGENTE(S) DE APOIO</h4>

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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-3 mt-3">
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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-3 mt-3">
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

                  {photoGroups.length > 0 && (
                    <div className="space-y-4">
                      {photoGroups.map((group, groupIndex) => (
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
                                  onClick={() => removePhoto(groupIndex, photoIndex)}
                                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div>
                            <Label htmlFor={`group-caption-${groupIndex}`} className="text-xs">
                              Descrição do grupo (opcional)
                            </Label>
                            <Textarea
                              id={`group-caption-${groupIndex}`}
                              placeholder="Descreva este grupo de fotos..."
                              value={group.caption}
                              onChange={(e) => updateGroupCaption(groupIndex, e.target.value)}
                              className="mt-1 resize-none"
                              rows={2}
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
