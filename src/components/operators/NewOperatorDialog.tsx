import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const operatorSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(255),
    active: z.boolean().default(true),
});

type OperatorFormData = z.infer<typeof operatorSchema>;

interface NewOperatorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function NewOperatorDialog({ open, onOpenChange, onSuccess }: NewOperatorDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<OperatorFormData>({
        resolver: zodResolver(operatorSchema),
        defaultValues: {
            name: '',
            active: true,
        },
    });

    const onSubmit = async (data: OperatorFormData) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('operators').insert({
                name: data.name,
                active: data.active,
            });

            if (error) throw error;

            toast.success('Operador cadastrado com sucesso!');
            form.reset();
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Erro ao cadastrar operador:', error);
            toast.error('Erro ao cadastrar operador');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Novo Operador</DialogTitle>
                    <DialogDescription>Cadastre um novo operador para o sistema</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome Completo *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nome do operador" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Ativo</FormLabel>
                                        <DialogDescription>
                                            O operador está ativo para receber chamados?
                                        </DialogDescription>
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

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : 'Salvar'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
