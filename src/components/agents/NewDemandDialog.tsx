import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MapPin, Loader2 } from 'lucide-react';

const demandSchema = z.object({
  city: z.string().min(2, 'A cidade é obrigatória'),
  state: z.string().min(2, 'A UF é obrigatória').max(2, 'Use apenas a sigla (ex: SP)'),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type DemandFormData = z.infer<typeof demandSchema>;

interface NewDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialCity?: string;
  initialState?: string;
  editingDemand?: {
    id: string;
    city: string;
    state: string;
    address: string | null;
    notes: string | null;
  } | null;
}

export function NewDemandDialog({ open, onOpenChange, onSuccess, initialCity = '', initialState = '', editingDemand = null }: NewDemandDialogProps) {
  const { user } = useAuth();
  const { geocode, isLoading: isGeocoding } = useGeocoding();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      city: initialCity,
      state: initialState,
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingDemand) {
        form.reset({
          city: editingDemand.city,
          state: editingDemand.state,
          address: editingDemand.address || '',
          notes: editingDemand.notes || '',
        });
      } else {
        form.reset({
          city: initialCity,
          state: initialState,
          address: '',
          notes: '',
        });
      }
    }
  }, [open, editingDemand, initialCity, initialState, form]);

  const onSubmit = async (data: DemandFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para registrar uma demanda');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get coordinates for the address or city/state
      let latitude = null;
      let longitude = null;
      let coords = null;
      
      if (data.address && data.address.trim() !== '') {
        // If address looks like coordinates (-14.23, -51.92)
        const coordMatch = data.address.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
        if (coordMatch) {
            coords = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[3]) };
        } else {
            // Geocode specific address
            coords = await geocode(`${data.address}, ${data.city}, ${data.state}, Brasil`);
        }
      }

      if (!coords) {
          const searchAddress = `${data.city}, ${data.state}, Brasil`;
          coords = await geocode(searchAddress);
      }
      
      // Fallback 1: Try just the state if city fails
      if (!coords && data.state) {
          coords = await geocode(`${data.state}, Brasil`);
      }
      
      // Fallback 2: Center of Brazil
      if (!coords) {
          coords = { lat: -14.2350, lng: -51.9253 };
      }
      
      if (coords) {
        latitude = coords.lat;
        // Apply a small random offset if we have multiple demands in the same city
        // so pins don't overlap completely (-0.01 to 0.01 is roughly 1km)
        longitude = coords.lng + (Math.random() - 0.5) * 0.02;
        latitude = latitude + (Math.random() - 0.5) * 0.02;
      }

      if (editingDemand) {
        const { error } = await supabase.from('agent_demands').update({
          city: data.city,
          state: data.state.toUpperCase(),
          address: data.address || null,
          notes: data.notes,
          latitude,
          longitude,
        }).eq('id', editingDemand.id);

        if (error) throw error;
        toast.success('Necessidade de agente atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('agent_demands').insert({
          city: data.city,
          state: data.state.toUpperCase(),
          address: data.address || null,
          notes: data.notes,
          latitude,
          longitude,
          status: 'pendente',
          created_by_user_id: user.id
        });

        if (error) throw error;
        toast.success('Necessidade de agente registrada com sucesso!');
      }

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao registrar demanda:', error);
      toast.error(error.message || 'Erro ao registrar necessidade no sistema');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-destructive" />
            {editingDemand ? 'Editar Falta de Agente' : 'Registrar Falta de Agente'}
          </DialogTitle>
          <DialogDescription>
            {editingDemand 
              ? 'Atualize os dados desta demanda de captação.' 
              : 'Registre um local onde você precisou de um agente e não encontrou, para buscar futuramente.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Manaus" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="AM" 
                          maxLength={2} 
                          className="uppercase" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço exato ou Coordenadas (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Rodovia BR-116, Km 42 ou -23.55, -46.63" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações adicionais</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ex: Tivemos 2 chamados de tombamento aqui na última semana e não tínhamos ninguém. Procurar urgente." 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isGeocoding}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting || isGeocoding}>
                {isSubmitting || isGeocoding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Salvar Demanda'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
