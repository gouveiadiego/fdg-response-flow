import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { useCepLookup } from '@/hooks/useCepLookup';
import { geocodeAddress } from '@/utils/geocoding';
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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const agentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  document: z.string().max(20).optional().nullable(),
  phone: z.string().min(1, 'Telefone é obrigatório').max(20),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z.string().max(10).optional(),
  street: z.string().max(300).optional(),
  street_number: z.string().max(50).optional(),
  neighborhood: z.string().max(150).optional(),
  city: z.string().max(150).optional(),
  state: z.string().max(2).optional(),
  is_armed: z.boolean().default(false),
  vehicle_plate: z.string().max(10).optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  notes: z.string().max(1000).optional(),
  pix_key: z.string().max(100).optional(),
  bank_name: z.string().max(100).optional(),
  bank_agency: z.string().max(20).optional(),
  bank_account: z.string().max(30).optional(),
  bank_account_type: z.enum(['corrente', 'poupanca']).optional(),
  performance_level: z.enum(['ruim', 'bom', 'otimo']).default('bom'),
  vehicle_type: z.enum(['carro', 'moto']).optional().or(z.literal('')),
  has_alarm_skill: z.boolean().default(false),
  has_investigation_skill: z.boolean().default(false),
  has_preservation_skill: z.boolean().default(false),
  has_logistics_skill: z.boolean().default(false),
  has_auditing_skill: z.boolean().default(false),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface EditAgentDialogProps {
  agentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const buildFullAddress = (data: AgentFormData): string =>
  [data.street, data.street_number, data.neighborhood, data.city, data.state]
    .filter(Boolean)
    .join(', ');

export function EditAgentDialog({ agentId, open, onOpenChange, onSuccess }: EditAgentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const { lookupCep, isLoading: isCepLoading } = useCepLookup();

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '', document: '', phone: '', email: '',
      cep: '', street: '', street_number: '', neighborhood: '', city: '', state: '',
      is_armed: false, vehicle_plate: '', status: 'ativo', notes: '',
      pix_key: '', bank_name: '', bank_agency: '', bank_account: '',
      bank_account_type: undefined, performance_level: 'bom', vehicle_type: '',
      has_alarm_skill: false, has_investigation_skill: false,
      has_preservation_skill: false, has_logistics_skill: false,
      has_auditing_skill: false, latitude: null, longitude: null,
    },
  });

  useEffect(() => {
    if (agentId && open) fetchAgent();
  }, [agentId, open]);

  const fetchAgent = async () => {
    if (!agentId) return;
    try {
      const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
      if (error) throw error;
      if (data) {
        form.reset({
          name: data.name,
          document: data.document || '',
          phone: data.phone,
          email: data.email || '',
          cep: (data as any).cep || '',
          street: (data as any).street || '',
          street_number: (data as any).street_number || '',
          neighborhood: (data as any).neighborhood || '',
          city: (data as any).city || '',
          state: (data as any).state || '',
          is_armed: data.is_armed || false,
          vehicle_plate: data.vehicle_plate || '',
          status: data.status,
          notes: data.notes || '',
          pix_key: (data as any).pix_key || '',
          bank_name: (data as any).bank_name || '',
          bank_agency: (data as any).bank_agency || '',
          bank_account: (data as any).bank_account || '',
          bank_account_type: (data as any).bank_account_type || undefined,
          performance_level: (data as any).performance_level || 'bom',
          vehicle_type: (data as any).vehicle_type || '',
          has_alarm_skill: (data as any).has_alarm_skill || false,
          has_investigation_skill: (data as any).has_investigation_skill || false,
          has_preservation_skill: (data as any).has_preservation_skill || false,
          has_logistics_skill: (data as any).has_logistics_skill || false,
          has_auditing_skill: (data as any).has_auditing_skill || false,
          latitude: (data as any).latitude || null,
          longitude: (data as any).longitude || null,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar agente:', error);
      toast.error('Erro ao carregar dados do agente');
    }
  };

  const handleCepLookup = async () => {
    const cep = form.getValues('cep');
    if (!cep) { toast.error('Digite um CEP'); return; }

    const result = await lookupCep(cep);
    if (result) {
      form.setValue('street', result.street);
      form.setValue('neighborhood', result.neighborhood);
      form.setValue('city', result.city);
      form.setValue('state', result.state);

      try {
        const coords = await geocodeAddress(result.fullAddress, `${result.city}, ${result.state}, BR`);
        if (coords) {
          form.setValue('latitude', coords.lat);
          form.setValue('longitude', coords.lon);
          toast.success('Endereço e coordenadas encontrados!');
        } else {
          toast.success('Endereço encontrado! Preencha o número e clique em "Buscar Coordenadas".');
        }
      } catch {
        toast.success('Endereço encontrado!');
      }
    }
  };

  const handleManualGeocode = async () => {
    const data = form.getValues();
    const fullAddress = buildFullAddress(data);
    if (!fullAddress) { toast.error('Preencha ao menos a rua para buscar as coordenadas'); return; }

    setIsGeocoding(true);
    try {
      const fallback = `${data.city}, ${data.state}, BR`;
      const coords = await geocodeAddress(`${fullAddress}, Brasil`, fallback);
      if (coords) {
        form.setValue('latitude', coords.lat);
        form.setValue('longitude', coords.lon);
        toast.success('Coordenadas encontradas!');
      } else {
        toast.error('Não foi possível encontrar coordenadas para este endereço.');
      }
    } catch {
      toast.error('Erro ao buscar coordenadas.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const onSubmit = async (data: AgentFormData) => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const fullAddress = buildFullAddress(data);
      const { error } = await supabase.from('agents').update({
        name: data.name,
        document: data.document,
        phone: data.phone,
        email: data.email || null,
        address: fullAddress || null,
        cep: data.cep || null,
        street: data.street || null,
        street_number: data.street_number || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        is_armed: data.is_armed,
        vehicle_plate: data.vehicle_plate || null,
        status: data.status,
        notes: data.notes || null,
        pix_key: data.pix_key || null,
        bank_name: data.bank_name || null,
        bank_agency: data.bank_agency || null,
        bank_account: data.bank_account || null,
        bank_account_type: data.bank_account_type || null,
        performance_level: data.performance_level,
        vehicle_type: (data.vehicle_type as any) || null,
        has_alarm_skill: data.has_alarm_skill,
        has_investigation_skill: data.has_investigation_skill,
        has_preservation_skill: data.has_preservation_skill,
        has_logistics_skill: data.has_logistics_skill,
        has_auditing_skill: data.has_auditing_skill,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      } as any).eq('id', agentId);

      if (error) throw error;
      toast.success('Agente atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar agente:', error);
      toast.error('Erro ao atualizar agente');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Agente</DialogTitle>
          <DialogDescription>Atualize os dados do agente</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">

              {/* ── Dados Pessoais ── */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl><Input placeholder="Nome do agente" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="document" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl><Input placeholder="000.000.000-00" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Endereço ── */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-sm font-semibold">Endereço</h3>

                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={handleCepLookup} disabled={isCepLoading}>
                        {isCepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FormField control={form.control} name="street" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua / Logradouro</FormLabel>
                        <FormControl><Input placeholder="Rua das Flores" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="street_number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número / Compl.</FormLabel>
                      <FormControl><Input placeholder="123 / Ap 4" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="neighborhood" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input placeholder="Centro" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl><Input placeholder="São Paulo" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado (UF)</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} className="uppercase" {...field}
                          onChange={e => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <FormLabel className="text-muted-foreground text-xs">Coordenadas Geográficas</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={handleManualGeocode} disabled={isGeocoding} className="h-8 text-xs">
                    {isGeocoding ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Search className="mr-2 h-3 w-3" />}
                    Buscar Coordenadas
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="latitude" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-00.000000"
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="longitude" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="-00.000000"
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* ── Veículo e Status ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="vehicle_plate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa do Veículo</FormLabel>
                    <FormControl><Input placeholder="ABC-1234" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vehicle_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Veículo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        <SelectItem value="carro">Carro</SelectItem>
                        <SelectItem value="moto">Moto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Habilidades ── */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-sm font-semibold">Habilidades e Especialidades</h3>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { name: 'is_armed', label: 'Armado', desc: 'Porta arma de fogo' },
                    { name: 'has_alarm_skill', label: 'Alarme', desc: 'Atendimento de alarmes' },
                    { name: 'has_investigation_skill', label: 'Averiguação', desc: 'Averiguação de ocorrências' },
                    { name: 'has_preservation_skill', label: 'Preservação', desc: 'Preservação de local' },
                    { name: 'has_logistics_skill', label: 'Acompanhamento Logístico', desc: 'Escolta e acompanhamento' },
                    { name: 'has_auditing_skill', label: 'Sindicância', desc: 'Levantamento de informações' },
                  ].map(skill => (
                    <FormField key={skill.name} control={form.control} name={skill.name as any} render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>{skill.label}</FormLabel>
                          <p className="text-xs text-muted-foreground">{skill.desc}</p>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              </div>

              {/* ── Desempenho ── */}
              <FormField control={form.control} name="performance_level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avaliação de Desempenho</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a avaliação" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ruim" className="text-destructive font-medium">Ruim</SelectItem>
                      <SelectItem value="bom" className="text-blue-500 font-medium">Bom</SelectItem>
                      <SelectItem value="otimo" className="text-emerald-500 font-medium">Ótimo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Dados Bancários ── */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3">Dados Bancários</h3>
                <FormField control={form.control} name="pix_key" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl><Input placeholder="CPF, E-mail, Telefone ou Chave Aleatória" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <FormField control={form.control} name="bank_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl><Input placeholder="Nome do banco" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bank_account_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Conta</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="corrente">Conta Corrente</SelectItem>
                          <SelectItem value="poupanca">Conta Poupança</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <FormField control={form.control} name="bank_agency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl><Input placeholder="0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bank_account" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta</FormLabel>
                      <FormControl><Input placeholder="00000-0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* ── Observações ── */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre o agente..." className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isLoading}>
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
