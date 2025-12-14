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

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface EditPlanDialogProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPlanDialog({ planId, open, onOpenChange, onSuccess }: EditPlanDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      category: '',
      description: '',
    },
  });

  useEffect(() => {
    if (planId && open) {
      fetchPlan();
    }
  }, [planId, open]);

  const fetchPlan = async () => {
    if (!planId) return;

    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          name: data.name,
          category: data.category || '',
          description: data.description || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar plano:', error);
      toast.error('Erro ao carregar dados do plano');
    }
  };

  const onSubmit = async (data: PlanFormData) => {
    if (!planId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          name: data.name,
          category: data.category || null,
          description: data.description || null,
        })
        .eq('id', planId);

      if (error) throw error;

      toast.success('Plano atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      toast.error('Erro ao atualizar plano');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Plano</DialogTitle>
          <DialogDescription>Atualize os dados do plano</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Plano *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 1 agente armado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: operacional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do plano..."
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
      </DialogContent>
    </Dialog>
  );
}
