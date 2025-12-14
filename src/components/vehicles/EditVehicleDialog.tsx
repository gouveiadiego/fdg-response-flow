import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const bodyTypeOptions = [
  { value: 'grade_baixa', label: 'Grade Baixa' },
  { value: 'grade_alta', label: 'Grade Alta' },
  { value: 'bau', label: 'Baú' },
  { value: 'sider', label: 'Sider' },
  { value: 'frigorifico', label: 'Frigorífico' },
  { value: 'container', label: 'Container' },
  { value: 'prancha', label: 'Prancha' },
];

const vehicleSchema = z.object({
  tractor_plate: z.string().max(10).optional(),
  tractor_brand: z.string().max(50).optional(),
  tractor_model: z.string().max(50).optional(),
  trailer1_plate: z.string().max(10).optional(),
  trailer1_body_type: z.string().optional(),
  trailer2_plate: z.string().max(10).optional(),
  trailer2_body_type: z.string().optional(),
  trailer3_plate: z.string().max(10).optional(),
  trailer3_body_type: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(500),
  color: z.string().max(30).optional(),
  year: z.coerce.number().min(1900).max(2100).optional().nullable(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface EditVehicleDialogProps {
  vehicleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditVehicleDialog({ vehicleId, open, onOpenChange, onSuccess }: EditVehicleDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      tractor_plate: '',
      tractor_brand: '',
      tractor_model: '',
      trailer1_plate: '',
      trailer1_body_type: '',
      trailer2_plate: '',
      trailer2_body_type: '',
      trailer3_plate: '',
      trailer3_body_type: '',
      description: '',
      color: '',
      year: null,
    },
  });

  useEffect(() => {
    if (vehicleId && open) {
      fetchVehicle();
    }
  }, [vehicleId, open]);

  const fetchVehicle = async () => {
    if (!vehicleId) return;

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          tractor_plate: data.tractor_plate || '',
          tractor_brand: data.tractor_brand || '',
          tractor_model: data.tractor_model || '',
          trailer1_plate: data.trailer1_plate || '',
          trailer1_body_type: data.trailer1_body_type || '',
          trailer2_plate: data.trailer2_plate || '',
          trailer2_body_type: data.trailer2_body_type || '',
          trailer3_plate: data.trailer3_plate || '',
          trailer3_body_type: data.trailer3_body_type || '',
          description: data.description,
          color: data.color || '',
          year: data.year,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar veículo:', error);
      toast.error('Erro ao carregar dados do veículo');
    }
  };

  const onSubmit = async (data: VehicleFormData) => {
    if (!vehicleId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          plate_main: data.tractor_plate || 'N/A',
          tractor_plate: data.tractor_plate || null,
          tractor_brand: data.tractor_brand || null,
          tractor_model: data.tractor_model || null,
          trailer1_plate: data.trailer1_plate || null,
          trailer1_body_type: (data.trailer1_body_type as any) || null,
          trailer2_plate: data.trailer2_plate || null,
          trailer2_body_type: (data.trailer2_body_type as any) || null,
          trailer3_plate: data.trailer3_plate || null,
          trailer3_body_type: (data.trailer3_body_type as any) || null,
          description: data.description,
          color: data.color || null,
          year: data.year || null,
        })
        .eq('id', vehicleId);

      if (error) throw error;

      toast.success('Veículo atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar veículo:', error);
      toast.error('Erro ao atualizar veículo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Veículo</DialogTitle>
          <DialogDescription>Atualize os dados do veículo</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição do Conjunto *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Scania R450 + Carreta Randon Graneleira"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />
              <p className="text-sm font-medium">Cavalo Mecânico</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tractor_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC-1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tractor_brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Scania" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tractor_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="R450" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <p className="text-sm font-medium">Carreta 1</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trailer1_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input placeholder="XYZ-9876" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trailer1_body_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Carroceria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bodyTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <p className="text-sm font-medium">Carreta 2 (opcional)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trailer2_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input placeholder="XYZ-9876" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trailer2_body_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Carroceria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bodyTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <p className="text-sm font-medium">Carreta 3 (opcional)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trailer3_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input placeholder="XYZ-9876" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trailer3_body_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Carroceria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bodyTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <p className="text-sm font-medium">Informações Adicionais</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Branco" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2024" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
