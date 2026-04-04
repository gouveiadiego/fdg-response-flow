import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  document: z.string().min(1, 'Documento é obrigatório').max(20),
  contact_name: z.string().max(255).optional(),
  contact_phone: z.string().max(20).optional(),
  contact_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z.string().max(10).optional(),
  street: z.string().max(300).optional(),
  street_number: z.string().max(50).optional(),
  neighborhood: z.string().max(150).optional(),
  city: z.string().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().min(2, 'Estado é obrigatório').max(2),
  notes: z.string().max(1000).optional(),
  is_alarme: z.boolean().default(false),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewClientDialog({ open, onOpenChange, onSuccess }: NewClientDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '', document: '', contact_name: '', contact_phone: '',
      contact_email: '', cep: '', street: '', street_number: '',
      neighborhood: '', city: '', state: '', notes: '',
      is_alarme: false,
    },
  });

  const handleCepLookup = async () => {
    const cep = form.getValues('cep');
    const clean = cep?.replace(/\D/g, '');
    if (!clean || clean.length !== 8) { toast.error('Digite um CEP válido (8 dígitos)'); return; }

    setIsCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      form.setValue('street', data.logradouro || '', { shouldValidate: true });
      form.setValue('neighborhood', data.bairro || '', { shouldValidate: true });
      form.setValue('city', data.localidade || '', { shouldValidate: true });
      form.setValue('state', data.uf || '', { shouldValidate: true });
      toast.success('Endereço preenchido automaticamente!');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsCepLoading(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    try {
      const fullAddress = [data.street, data.street_number, data.neighborhood, data.city, data.state]
        .filter(Boolean).join(', ');

      const { data: insertedClient, error } = await supabase.from('clients').insert({
        name: data.name,
        document: data.document,
        contact_name: data.contact_name || null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        address: fullAddress || null,
        cep: data.cep || null,
        street: data.street || null,
        street_number: data.street_number || null,
        neighborhood: data.neighborhood || null,
        city: data.city,
        state: data.state,
        notes: data.notes || null,
      } as any).select().single();

      if (error) throw error;
      
      if (data.is_alarme && insertedClient) {
        const { error: vehicleError } = await supabase.from('vehicles').insert({
          client_id: insertedClient.id,
          plate_main: 'ALARME',
          description: 'Base do Cliente',
          type: 'outro'
        });
        if (vehicleError) {
          console.error('Erro ao criar veículo de alarme:', vehicleError);
          toast.warning('Cliente criado, mas falhou ao criar veículo de alarme.');
        }
      }

      toast.success('Cliente cadastrado com sucesso!');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>Preencha os dados do cliente</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">

              {/* Dados da Empresa */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão Social / Nome *</FormLabel>
                  <FormControl><Input placeholder="Nome do cliente" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="document" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ / CPF *</FormLabel>
                  <FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="contact_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Contato</FormLabel>
                    <FormControl><Input placeholder="Nome" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contact_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="contact_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Endereço */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-sm font-semibold">Endereço</h3>

                {/* CEP */}
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

                {/* Rua + Número */}
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
                      <FormControl><Input placeholder="123 / Sala 4" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Bairro */}
                <FormField control={form.control} name="neighborhood" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input placeholder="Centro" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Cidade + Estado */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade *</FormLabel>
                        <FormControl><Input placeholder="São Paulo" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado *</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} className="uppercase" {...field}
                          onChange={e => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Observações */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre o cliente..." className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="is_alarme" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-orange-500/5 border-orange-500/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-orange-400">Cliente Exclusivo de Alarme</FormLabel>
                    <DialogDescription className="text-xs">
                      Marca este cliente para não exigir veículo na criação de chamados.
                    </DialogDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
