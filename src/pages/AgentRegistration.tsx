import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, CheckCircle2, Shield } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const registrationSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(255),
    document: z.string().min(1, 'CPF é obrigatório').max(20),
    phone: z.string().min(1, 'Telefone é obrigatório').max(20),
    email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    cep: z.string().max(10).optional(),
    is_armed: z.boolean().default(false),
    vehicle_plate: z.string().max(10).optional(),
    vehicle_type: z.string().optional(),
    has_alarm_skill: z.boolean().default(false),
    has_investigation_skill: z.boolean().default(false),
    has_preservation_skill: z.boolean().default(false),
    has_logistics_skill: z.boolean().default(false),
    has_auditing_skill: z.boolean().default(false),
    pix_key: z.string().max(100).optional(),
    bank_name: z.string().max(100).optional(),
    bank_agency: z.string().max(20).optional(),
    bank_account: z.string().max(30).optional(),
    bank_account_type: z.string().optional(),
    notes: z.string().max(1000).optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function AgentRegistration() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isCepLoading, setIsCepLoading] = useState(false);

    const form = useForm<RegistrationFormData>({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            name: '',
            document: '',
            phone: '',
            email: '',
            address: '',
            cep: '',
            is_armed: false,
            vehicle_plate: '',
            vehicle_type: '',
            has_alarm_skill: false,
            has_investigation_skill: false,
            has_preservation_skill: false,
            has_logistics_skill: false,
            has_auditing_skill: false,
            pix_key: '',
            bank_name: '',
            bank_agency: '',
            bank_account: '',
            bank_account_type: '',
            notes: '',
        },
    });

    const handleCepLookup = async () => {
        const cep = form.getValues('cep');
        if (!cep) return;

        setIsCepLoading(true);
        try {
            const cleanCep = cep.replace(/\D/g, '');
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();
            if (!data.erro) {
                const address = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
                form.setValue('address', address);
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setIsCepLoading(false);
        }
    };

    const onSubmit = async (data: RegistrationFormData) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.from('agent_registrations' as any).insert({
                name: data.name,
                document: data.document,
                phone: data.phone,
                email: data.email || null,
                address: data.address || null,
                cep: data.cep || null,
                is_armed: data.is_armed,
                vehicle_plate: data.vehicle_plate || null,
                vehicle_type: data.vehicle_type && data.vehicle_type !== 'none' ? data.vehicle_type : null,
                has_alarm_skill: data.has_alarm_skill,
                has_investigation_skill: data.has_investigation_skill,
                has_preservation_skill: data.has_preservation_skill,
                has_logistics_skill: data.has_logistics_skill,
                has_auditing_skill: data.has_auditing_skill,
                pix_key: data.pix_key || null,
                bank_name: data.bank_name || null,
                bank_agency: data.bank_agency || null,
                bank_account: data.bank_account || null,
                bank_account_type: data.bank_account_type && data.bank_account_type !== 'none' ? data.bank_account_type : null,
                notes: data.notes || null,
            } as any);

            if (error) throw error;
            setIsSuccess(true);
        } catch (error) {
            console.error('Erro ao enviar cadastro:', error);
            alert('Erro ao enviar cadastro. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-white/10 backdrop-blur-xl border-white/20 text-white">
                    <CardContent className="pt-8 pb-8 text-center space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold">Cadastro Enviado!</h2>
                        <p className="text-white/70">
                            Seus dados foram enviados com sucesso. Aguarde a aprovação da equipe FDG Pronta Resposta.
                        </p>
                        <p className="text-sm text-white/50">
                            Você será contatado após a análise do seu cadastro.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <div className="bg-black/30 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">FDG Pronta Resposta</h1>
                        <p className="text-sm text-white/60">Cadastro de Agente</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-2xl mx-auto px-4 py-8">
                <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                    <CardContent className="pt-6">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-white">Preencha seus dados</h2>
                            <p className="text-sm text-white/50">Os campos com * são obrigatórios</p>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                {/* Dados Pessoais */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Dados Pessoais</h3>

                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-white/80">Nome Completo *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Seu nome completo" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                <FormLabel className="text-white/80">CPF *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="000.000.000-00" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                    <FormLabel className="text-white/80">Telefone *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="(00) 00000-0000" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                    <FormLabel className="text-white/80">E-mail</FormLabel>
                                                    <FormControl>
                                                        <Input type="email" placeholder="email@exemplo.com" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Endereço */}
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Endereço</h3>

                                    <FormField
                                        control={form.control}
                                        name="cep"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-white/80">CEP</FormLabel>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input placeholder="00000-000" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                                                    </FormControl>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        onClick={handleCepLookup}
                                                        disabled={isCepLoading}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white border-0"
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
                                                <FormLabel className="text-white/80">Endereço Completo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Rua, número, bairro, cidade - UF" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Veículo */}
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Veículo</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="vehicle_plate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/80">Placa do Veículo</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="ABC-1234" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                    <FormLabel className="text-white/80">Tipo de Veículo</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                                                <SelectValue placeholder="Selecione..." />
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
                                    </div>
                                </div>

                                {/* Habilidades */}
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Habilidades e Especialidades</h3>

                                    <div className="space-y-3 bg-black/20 rounded-lg p-4 border border-white/5">
                                        <FormField
                                            control={form.control}
                                            name="is_armed"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Armado</FormLabel>
                                                        <p className="text-xs text-white/40">Porta arma de fogo</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="has_alarm_skill"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Alarme</FormLabel>
                                                        <p className="text-xs text-white/40">Atendimento de alarmes</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="has_investigation_skill"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Averiguação</FormLabel>
                                                        <p className="text-xs text-white/40">Averiguação de ocorrências</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="has_preservation_skill"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Preservação</FormLabel>
                                                        <p className="text-xs text-white/40">Preservação de local</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="has_logistics_skill"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Acompanhamento Logístico</FormLabel>
                                                        <p className="text-xs text-white/40">Escolta e acompanhamento</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="has_auditing_skill"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-white/80">Sindicância</FormLabel>
                                                        <p className="text-xs text-white/40">Levantamento de informações</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-amber-500"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Dados Bancários */}
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Dados Bancários</h3>

                                    <FormField
                                        control={form.control}
                                        name="pix_key"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-white/80">Chave PIX</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="CPF, E-mail, Telefone ou Chave Aleatória" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="bank_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/80">Banco</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Nome do banco" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                    <FormLabel className="text-white/80">Tipo de Conta</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="none">Selecione...</SelectItem>
                                                            <SelectItem value="corrente">Conta Corrente</SelectItem>
                                                            <SelectItem value="poupanca">Conta Poupança</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="bank_agency"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/80">Agência</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="0000" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
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
                                                    <FormLabel className="text-white/80">Conta</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="00000-0" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Observações */}
                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Observações</h3>

                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Informações adicionais sobre você..."
                                                        className="resize-none bg-white/10 border-white/20 text-white placeholder:text-white/30"
                                                        rows={3}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold py-6 text-base"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        'Enviar Cadastro'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <p className="text-center text-white/30 text-xs mt-6">
                    FDG Pronta Resposta © {new Date().getFullYear()} — Todos os direitos reservados
                </p>
            </div>
        </div>
    );
}
