import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import { MapPin, Search, Loader2 } from 'lucide-react';

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

interface EditTicketDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTicketDialog({ ticketId, open, onOpenChange, onSuccess }: EditTicketDialogProps) {
  const { reverseGeocode, isLoading: isGeocoding } = useGeocoding();
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

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

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (ticketId && open && clients.length > 0) {
      fetchTicket();
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

  const onSubmit = async (data: TicketFormData) => {
    if (!ticketId) return;

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

      toast.success('Chamado atualizado com sucesso!');
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
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                  <TabsTrigger value="operation">Operação</TabsTrigger>
                  <TabsTrigger value="report">Relatório</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
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

                <TabsContent value="operation" className="space-y-4 mt-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="support_agent_1_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apoio 1</FormLabel>
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
                          <FormLabel>Chegada</FormLabel>
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
                          <FormLabel>Saída</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="support_agent_2_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apoio 2</FormLabel>
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
                          <FormLabel>Chegada</FormLabel>
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
                          <FormLabel>Saída</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  </div>
                </TabsContent>

                <TabsContent value="report" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resumo</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Breve resumo do atendimento..."
                            className="resize-none"
                            rows={3}
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
                        <FormLabel>Relatório Detalhado</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Relatório detalhado do atendimento..."
                            className="resize-none"
                            rows={8}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
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
