import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { MapPin, Upload, X, Camera } from 'lucide-react';

const ticketSchema = z.object({
  client_id: z.string().min(1, 'Selecione um cliente'),
  vehicle_id: z.string().min(1, 'Selecione um veículo'),
  plan_id: z.string().min(1, 'Selecione um plano'),
  service_type: z.enum(['alarme', 'averiguacao', 'preservacao', 'acompanhamento_logistico']),
  main_agent_id: z.string().min(1, 'Selecione um agente'),
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
  const [activeTab, setActiveTab] = useState('cliente');
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      client_id: '',
      vehicle_id: '',
      plan_id: '',
      service_type: 'alarme',
      main_agent_id: '',
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
      detailed_report: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const tollCost = form.watch('toll_cost') || 0;
  const foodCost = form.watch('food_cost') || 0;
  const otherCosts = form.watch('other_costs') || 0;
  const totalCost = tollCost + foodCost + otherCosts;

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedClientId) {
      const clientVehicles = vehicles.filter(v => v.client_id === selectedClientId);
      setFilteredVehicles(clientVehicles);
      
      // Auto-fill city/state from selected client
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        form.setValue('city', selectedClient.city);
        form.setValue('state', selectedClient.state);
      }
      
      // Reset vehicle if not from selected client
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
        supabase.from('agents').select('id, name').eq('status', 'ativo').order('name'),
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

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = Array.from(files);
      setPhotos(prev => [...prev, ...newPhotos]);
      
      // Create preview URLs
      newPhotos.forEach(file => {
        const url = URL.createObjectURL(file);
        setPhotoUrls(prev => [...prev, url]);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(photoUrls[index]);
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (ticketId: string) => {
    const uploadedUrls: string[] = [];
    
    for (const photo of photos) {
      const fileName = `${ticketId}/${Date.now()}-${photo.name}`;
      const { data, error } = await supabase.storage
        .from('ticket-photos')
        .upload(fileName, photo);
      
      if (error) {
        console.error('Erro ao fazer upload:', error);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('ticket-photos')
        .getPublicUrl(fileName);
      
      uploadedUrls.push(urlData.publicUrl);
    }
    
    return uploadedUrls;
  };

  const onSubmit = async (data: TicketFormData) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          client_id: data.client_id,
          vehicle_id: data.vehicle_id,
          plan_id: data.plan_id,
          service_type: data.service_type,
          main_agent_id: data.main_agent_id,
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
          detailed_report: data.detailed_report,
          created_by_user_id: user.id,
          code: '', // Will be generated by trigger
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload photos if any
      if (photos.length > 0 && ticket) {
        const photoUrls = await uploadPhotos(ticket.id);
        
        // Save photo references
        for (const url of photoUrls) {
          await supabase.from('ticket_photos').insert({
            ticket_id: ticket.id,
            file_url: url,
            uploaded_by_user_id: user.id,
          });
        }
      }

      toast.success('Chamado criado com sucesso!');
      form.reset();
      setPhotos([]);
      setPhotoUrls([]);
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
                <TabsTrigger value="agente">Agente</TabsTrigger>
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

                <div className="flex items-end gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="coordinates_lat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="any"
                              placeholder="Ex: -23.5505"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="coordinates_lng"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="any"
                              placeholder="Ex: -46.6333"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={getLocation}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Localização Atual
                  </Button>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={goToNextTab}>
                    Próximo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="agente" className="space-y-4 mt-4">
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
                                {agent.name}
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
                      value={
                        filteredVehicles.find(v => v.id === form.getValues('vehicle_id'))
                          ? `${filteredVehicles.find(v => v.id === form.getValues('vehicle_id'))?.description} - ${filteredVehicles.find(v => v.id === form.getValues('vehicle_id'))?.plate_main}`
                          : 'Nenhum veículo selecionado'
                      }
                      disabled
                      className="mt-2"
                    />
                  </div>

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
                        <FormMessage />
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                        <FormMessage />
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="other_costs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outros Gastos (R$)</FormLabel>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Label>Total de Gastos</Label>
                    <Input 
                      value={`R$ ${totalCost.toFixed(2)}`}
                      disabled
                      className="mt-2 font-semibold"
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="detailed_report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Evento</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva os detalhes do atendimento..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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

                {photoUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {photoUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
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
