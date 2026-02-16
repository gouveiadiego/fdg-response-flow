import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { NewOperatorDialog } from '@/components/operators/NewOperatorDialog';
import { EditOperatorDialog } from '@/components/operators/EditOperatorDialog';
import { RoleGuard } from '@/components/RoleGuard';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';

interface Operator {
    id: string;
    name: string;
    active: boolean;
}

const Operators = () => {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [operatorToDelete, setOperatorToDelete] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchOperators();
    }, []);

    const fetchOperators = async () => {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('id, name, active')
                .order('name');

            if (error) throw error;
            setOperators(data || []);
        } catch (error) {
            console.error('Erro ao buscar operadores:', error);
            toast.error('Erro ao carregar operadores');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (operatorId: string) => {
        setSelectedOperatorId(operatorId);
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (operatorId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOperatorToDelete(operatorId);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!operatorToDelete) return;

        setDeleteLoading(true);
        try {
            const { error, count } = await supabase
                .from('operators')
                .delete({ count: 'exact' })
                .eq('id', operatorToDelete);

            if (error) throw error;

            if (count === 0) {
                toast.error('Erro: Operador não encontrado ou permissão negada.');
            } else {
                toast.success('Operador excluído com sucesso');
                setOperators(operators.filter(o => o.id !== operatorToDelete));
                fetchOperators();
            }
        } catch (error: any) {
            console.error('Erro ao excluir operador:', error);
            if (error.code === '23503') {
                toast.error('Não é possível excluir este operador pois existem chamados vinculados a ele.');
            } else {
                toast.error('Erro ao excluir operador.');
            }
        } finally {
            setDeleteLoading(false);
            setDeleteDialogOpen(false);
            setOperatorToDelete(null);
        }
    };

    const filteredOperators = operators.filter((operator) =>
        operator.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                    <p className="text-muted-foreground">Carregando operadores...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Operadores</h1>
                    <p className="text-muted-foreground">Gerencie os operadores da central</p>
                </div>
                <RoleGuard allowedRoles={['admin', 'operador']}>
                    <Button onClick={() => setNewDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Operador
                    </Button>
                </RoleGuard>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar operador por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>

            {filteredOperators.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <User className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">Nenhum operador encontrado</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {searchTerm ? 'Tente buscar com outros termos' : 'Comece cadastrando um novo operador'}
                        </p>
                        {!searchTerm && (
                            <RoleGuard allowedRoles={['admin', 'operador']}>
                                <Button onClick={() => setNewDialogOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Cadastrar Operador
                                </Button>
                            </RoleGuard>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOperators.map((operator) => (
                        <Card key={operator.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary" />
                                        <span className="truncate">{operator.name}</span>
                                    </CardTitle>
                                    <Badge variant={operator.active ? 'default' : 'outline'}>
                                        {operator.active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Status: {operator.active ? 'Disponível para chamados' : 'Indisponível'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RoleGuard allowedRoles={['admin', 'operador']}>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleEdit(operator.id)}
                                        >
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 px-0"
                                            onClick={(e) => handleDeleteClick(operator.id, e)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </RoleGuard>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <NewOperatorDialog
                open={newDialogOpen}
                onOpenChange={setNewDialogOpen}
                onSuccess={fetchOperators}
            />

            <EditOperatorDialog
                operatorId={selectedOperatorId}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSuccess={fetchOperators}
            />

            <DeleteAlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleConfirmDelete}
                title="Excluir Operador"
                description="Tem certeza que deseja excluir este operador? Esta ação não pode ser desfeita."
                loading={deleteLoading}
            />
        </div>
    );
};

export default Operators;
