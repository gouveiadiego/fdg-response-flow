import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    CheckCircle2,
    XCircle,
    Eye,
    UserPlus,
    Phone,
    Mail,
    MapPin,
    Car,
    Shield,
    CreditCard,
    Clock,
    Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentRegistration {
    id: string;
    name: string;
    document: string;
    phone: string;
    email: string | null;
    address: string | null;
    cep: string | null;
    is_armed: boolean;
    vehicle_plate: string | null;
    vehicle_type: string | null;
    has_alarm_skill: boolean;
    has_investigation_skill: boolean;
    has_preservation_skill: boolean;
    has_logistics_skill: boolean;
    has_auditing_skill: boolean;
    pix_key: string | null;
    bank_name: string | null;
    bank_agency: string | null;
    bank_account: string | null;
    bank_account_type: string | null;
    notes: string | null;
    latitude: number | null;
    longitude: number | null;
    status: string;
    created_at: string;
}

interface AgentRegistrationReviewProps {
    onAgentApproved: () => void;
}

export function AgentRegistrationReview({ onAgentApproved }: AgentRegistrationReviewProps) {
    const { user } = useAuth();
    const [registrations, setRegistrations] = useState<AgentRegistration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReg, setSelectedReg] = useState<AgentRegistration | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [approving, setApproving] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<string | null>(null);

    const fetchRegistrations = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('agent_registrations' as any)
                .select('*')
                .eq('status', 'pendente')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRegistrations((data || []) as any);
        } catch (error) {
            console.error('Erro ao buscar cadastros:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const handleApprove = async (reg: AgentRegistration) => {
        setApproving(reg.id);
        try {
            // 1. Create agent from registration data
            const { error: agentError } = await supabase.from('agents').insert({
                name: reg.name,
                document: reg.document,
                phone: reg.phone,
                email: reg.email,
                address: reg.address,
                cep: reg.cep,
                is_armed: reg.is_armed,
                vehicle_plate: reg.vehicle_plate,
                vehicle_type: (reg.vehicle_type as any) || null,
                has_alarm_skill: reg.has_alarm_skill,
                has_investigation_skill: reg.has_investigation_skill,
                has_preservation_skill: reg.has_preservation_skill,
                has_logistics_skill: reg.has_logistics_skill,
                has_auditing_skill: reg.has_auditing_skill,
                pix_key: reg.pix_key,
                bank_name: reg.bank_name,
                bank_agency: reg.bank_agency,
                bank_account: reg.bank_account,
                bank_account_type: reg.bank_account_type,
                notes: reg.notes,
                latitude: reg.latitude,
                longitude: reg.longitude,
                status: 'ativo',
                performance_level: 'bom',
            });

            if (agentError) throw agentError;

            // 2. Mark registration as approved
            const { error: updateError } = await supabase
                .from('agent_registrations' as any)
                .update({
                    status: 'aprovado',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user?.id,
                } as any)
                .eq('id', reg.id);

            if (updateError) throw updateError;

            toast.success(`Agente ${reg.name} aprovado com sucesso!`);
            setRegistrations(prev => prev.filter(r => r.id !== reg.id));
            setDetailOpen(false);
            onAgentApproved();
        } catch (error) {
            console.error('Erro ao aprovar:', error);
            toast.error('Erro ao aprovar cadastro');
        } finally {
            setApproving(null);
        }
    };

    const handleReject = async (reg: AgentRegistration) => {
        setRejecting(reg.id);
        try {
            const { error } = await supabase
                .from('agent_registrations' as any)
                .update({
                    status: 'rejeitado',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: user?.id,
                } as any)
                .eq('id', reg.id);

            if (error) throw error;

            toast.success('Cadastro rejeitado');
            setRegistrations(prev => prev.filter(r => r.id !== reg.id));
            setDetailOpen(false);
        } catch (error) {
            console.error('Erro ao rejeitar:', error);
            toast.error('Erro ao rejeitar cadastro');
        } finally {
            setRejecting(null);
        }
    };

    const getSkills = (reg: AgentRegistration) => {
        const skills = [];
        if (reg.is_armed) skills.push('Armado');
        if (reg.has_alarm_skill) skills.push('Alarme');
        if (reg.has_investigation_skill) skills.push('Averiguação');
        if (reg.has_preservation_skill) skills.push('Preservação');
        if (reg.has_logistics_skill) skills.push('Logístico');
        if (reg.has_auditing_skill) skills.push('Sindicância');
        return skills;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (registrations.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum cadastro pendente</p>
                <p className="text-sm">Quando um agente se cadastrar pelo link público, aparecerá aqui.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {registrations.map((reg) => (
                <Card key={reg.id} className="border-amber-200/50 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-base truncate">{reg.name}</h3>
                                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-100/50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-900/30 text-xs shrink-0">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Pendente
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> {reg.phone}
                                    </span>
                                    {reg.email && (
                                        <span className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {reg.email}
                                        </span>
                                    )}
                                    {reg.address && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> {reg.address.substring(0, 40)}...
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {getSkills(reg).map(skill => (
                                        <Badge key={skill} variant="secondary" className="text-xs">
                                            {skill}
                                        </Badge>
                                    ))}
                                </div>

                                <p className="text-xs text-muted-foreground mt-2">
                                    Enviado em {format(new Date(reg.created_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>

                            <div className="flex gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setSelectedReg(reg); setDetailOpen(true); }}
                                >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleApprove(reg)}
                                    disabled={approving === reg.id}
                                >
                                    {approving === reg.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 mr-1" />
                                            Aprovar
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleReject(reg)}
                                    disabled={rejecting === reg.id}
                                >
                                    {rejecting === reg.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <XCircle className="h-4 w-4 mr-1" />
                                            Rejeitar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Cadastro</DialogTitle>
                        <DialogDescription>Revise os dados enviados pelo agente</DialogDescription>
                    </DialogHeader>

                    {selectedReg && (
                        <ScrollArea className="max-h-[calc(90vh-180px)]">
                            <div className="space-y-6 pr-4">

                                {/* Dados Pessoais */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                                        <UserPlus className="h-4 w-4" /> Dados Pessoais
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Nome</p>
                                            <p className="font-medium">{selectedReg.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">CPF</p>
                                            <p className="font-medium">{selectedReg.document}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Telefone</p>
                                            <p className="font-medium">{selectedReg.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">E-mail</p>
                                            <p className="font-medium">{selectedReg.email || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Endereço */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                                        <MapPin className="h-4 w-4" /> Endereço
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">CEP</p>
                                            <p className="font-medium">{selectedReg.cep || '-'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground text-xs">Endereço</p>
                                            <p className="font-medium">{selectedReg.address || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Veículo */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                                        <Car className="h-4 w-4" /> Veículo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Placa</p>
                                            <p className="font-medium">{selectedReg.vehicle_plate || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Tipo</p>
                                            <p className="font-medium capitalize">{selectedReg.vehicle_type || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Habilidades */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                                        <Shield className="h-4 w-4" /> Habilidades
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                        {getSkills(selectedReg).length > 0 ? (
                                            getSkills(selectedReg).map(skill => (
                                                <Badge key={skill} variant="secondary">{skill}</Badge>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Nenhuma habilidade selecionada</p>
                                        )}
                                    </div>
                                </div>

                                {/* Dados Bancários */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                                        <CreditCard className="h-4 w-4" /> Dados Bancários
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground text-xs">Chave PIX</p>
                                            <p className="font-medium">{selectedReg.pix_key || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Banco</p>
                                            <p className="font-medium">{selectedReg.bank_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Tipo</p>
                                            <p className="font-medium capitalize">{selectedReg.bank_account_type || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Agência</p>
                                            <p className="font-medium">{selectedReg.bank_agency || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Conta</p>
                                            <p className="font-medium">{selectedReg.bank_account || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Observações */}
                                {selectedReg.notes && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-primary mb-2">Observações</h4>
                                        <p className="text-sm">{selectedReg.notes}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => handleApprove(selectedReg)}
                                        disabled={approving === selectedReg.id}
                                    >
                                        {approving === selectedReg.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                        )}
                                        Aprovar e Criar Agente
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleReject(selectedReg)}
                                        disabled={rejecting === selectedReg.id}
                                    >
                                        {rejecting === selectedReg.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <XCircle className="h-4 w-4 mr-2" />
                                        )}
                                        Rejeitar
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
