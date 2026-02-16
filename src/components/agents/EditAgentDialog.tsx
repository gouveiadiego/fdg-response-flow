import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { useCepLookup } from '@/hooks/useCepLookup';
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
  document: z.string().min(1, 'Documento é obrigatório').max(20),
  phone: z.string().min(1, 'Telefone é obrigatório').max(20),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  cep: z.string().max(10).optional(),
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
});

type AgentFormData = z.infer<typeof agentSchema>;

interface EditAgentDialogProps {
  agentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAgentDialog({ agentId, open, onOpenChange, onSuccess }: EditAgentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { lookupCep, isLoading: isCepLoading } = useCepLookup();

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      document: '',
      phone: '',
      email: '',
      address: '',
      cep: '',
      is_armed: false,
      vehicle_plate: '',
      status: 'ativo',
      notes: '',
      pix_key: '',
      bank_name: '',
      bank_agency: '',
      bank_account: '',
      bank_account_type: undefined,
      performance_level: 'bom',
      vehicle_type: '',
    },
  });

  useEffect(() => {
    if (agentId && open) {
      fetchAgent();
    }
  }, [agentId, open]);

  const fetchAgent = async () => {
    if (!agentId) return;

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          name: data.name,
          document: data.document,
          phone: data.phone,
          email: data.email || '',
          address: data.address || '',
          cep: (data as any).cep || '',
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
        });
      }
    } catch (error) {
      console.error('Erro ao carregar agente:', error);
      toast.error('Erro ao carregar dados do agente');
    }
  };

  const handleCepLookup = async () => {
    const cep = form.getValues('cep');
    if (!cep) {
      toast.error('Digite um CEP');
      return;
    }

    const result = await lookupCep(cep);
    if (result) {
      form.setValue('address', result.address);
      toast.success('Endereço encontrado!');
    }
  };

  const onSubmit = async (data: AgentFormData) => {
    if (!agentId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          name: data.name,
          document: data.document,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          cep: data.cep || null,
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
        })
        .eq('id', agentId);

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
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do agente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="00000-000" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCepLookup}
                        disabled={isCepLoading}
                      >
                        {isCepLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Endereço completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vehicle_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa do Veículo</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC-1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicle_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Veículo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Selecione...</SelectItem>
                          <SelectItem value="carro">Carro</SelectItem>
                          <SelectItem value="moto">Moto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_armed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Armado</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        O agente porta arma de fogo?
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="performance_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avaliação de Desempenho</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a avaliação" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ruim" className="text-destructive font-medium">Ruim</SelectItem>
                        <SelectItem value="bom" className="text-blue-500 font-medium">Bom</SelectItem>
                        <SelectItem value="otimo" className="text-emerald-500 font-medium">Ótimo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Seção de Dados Bancários */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3">Dados Bancários</h3>

                <FormField
                  control={form.control}
                  name="pix_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave PIX</FormLabel>
                      <FormControl>
                        <Input placeholder="CPF, E-mail, Telefone ou Chave Aleatória" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do banco" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_account_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Conta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="corrente">Conta Corrente</SelectItem>
                            <SelectItem value="poupanca">Conta Poupança</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="bank_agency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input placeholder="0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta</FormLabel>
                        <FormControl>
                          <Input placeholder="00000-0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre o agente..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
