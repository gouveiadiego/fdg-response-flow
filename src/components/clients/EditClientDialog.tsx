import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { ClientVehiclesSection } from '@/components/clients/ClientVehiclesSection';

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
  status: z.enum(['ativo', 'inativo', 'pre_cadastro']).default('ativo'),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface EditClientDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditClientDialog({ clientId, open, onOpenChange, onSuccess }: EditClientDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '', document: '', contact_name: '', contact_phone: '',
      contact_email: '', cep: '', street: '', street_number: '',
      neighborhood: '', city: '', state: '', notes: '',
    },
  });

  useEffect(() => {
    if (clientId && open) fetchClient();
  }, [clientId, open]);

  const fetchClient = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      if (data) {
        form.reset({
          name: data.name,
          document: data.document,
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          cep: data.cep || '',
          street: (data as any).street || '',
          street_number: (data as any).street_number || '',
          neighborhood: (data as any).neighborhood || '',
          city: data.city,
          state: data.state,
          notes: data.notes || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error('Erro ao carregar dados do cliente');
    }
  };

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
    if (!clientId) return;
    setIsLoading(true);
    try {
      const fullAddress = [data.street, data.street_number, data.neighborhood, data.city, data.state]
        .filter(Boolean).join(', ');

      const { error } = await supabase.from('clients').update({
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
      } as any).eq('id', clientId);

      if (error) throw error;
      toast.success('Cliente atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Atualize os dados do cliente</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">

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
                      <FormControl><Input placeholder="123 / Sala 4" {...field} /></FormControl>
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

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre o cliente..." className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {clientId && <ClientVehiclesSection clientId={clientId} />}

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
