import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, UserCheck, Phone, Mail, Shield, ShieldOff, Trash2, Car, Bike } from 'lucide-react';
import { toast } from 'sonner';
import { NewAgentDialog } from '@/components/agents/NewAgentDialog';
import { EditAgentDialog } from '@/components/agents/EditAgentDialog';
import { RoleGuard } from '@/components/RoleGuard';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';

interface Agent {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string | null;
  status: 'ativo' | 'inativo';
  is_armed: boolean | null;
  performance_level: 'ruim' | 'bom' | 'otimo';
  vehicle_type: 'carro' | 'moto' | null;
  vehicle_plate: string | null;
}

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, document, phone, email, status, is_armed, performance_level, vehicle_type, vehicle_plate')
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
      toast.error('Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agentId: string) => {
    setSelectedAgentId(agentId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAgentToDelete(agentId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;

    setDeleteLoading(true);
    try {
      // Check for tickets as main agent
      const { count: mainAgentCount, error: mainAgentError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('main_agent_id', agentToDelete);

      if (mainAgentError) throw mainAgentError;

      if (mainAgentCount && mainAgentCount > 0) {
        toast.error(`Não é possível excluir: Agente é o principal em ${mainAgentCount} chamado(s).`);
        return;
      }

      // Check for tickets as support agent 1
      const { count: support1Count, error: support1Error } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('support_agent_1_id', agentToDelete);

      if (support1Error) throw support1Error;

      if (support1Count && support1Count > 0) {
        toast.error(`Não é possível excluir: Agente está como suporte 1 em ${support1Count} chamado(s).`);
        return;
      }

      // Check for tickets as support agent 2
      const { count: support2Count, error: support2Error } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('support_agent_2_id', agentToDelete);

      if (support2Error) throw support2Error;

      if (support2Count && support2Count > 0) {
        toast.error(`Não é possível excluir: Agente está como suporte 2 em ${support2Count} chamado(s).`);
        return;
      }

      const { error, count } = await supabase
        .from('agents')
        .delete({ count: 'exact' })
        .eq('id', agentToDelete);

      if (error) throw error;

      if (count === 0) {
        toast.error('Erro: Agente não encontrado ou permissão negada.');
      } else {
        toast.success('Agente excluído com sucesso');
        setAgents(agents.filter(a => a.id !== agentToDelete));
        fetchAgents();
      }
    } catch (error: any) {
      console.error('Erro ao excluir agente:', error);
      if (error.code === '23503') {
        toast.error('Não é possível excluir este agente pois existem chamados vinculados a ele.');
      } else {
        toast.error('Erro ao excluir agente.');
      }
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando agentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Agentes</h1>
          <p className="text-muted-foreground">Gerencie a equipe de agentes</p>
        </div>
        <RoleGuard allowedRoles={['admin', 'operador']}>
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agente
          </Button>
        </RoleGuard>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar agente por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum agente encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? 'Tente buscar com outros termos' : 'Comece cadastrando um novo agente'}
            </p>
            {!searchTerm && (
              <RoleGuard allowedRoles={['admin', 'operador']}>
                <Button onClick={() => setNewDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Agente
                </Button>
              </RoleGuard>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <span className="truncate">{agent.name}</span>
                  </CardTitle>
                  <div className="flex gap-1">
                    {agent.is_armed ? (
                      <Badge variant="destructive" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Armado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <ShieldOff className="h-3 w-3 mr-1" />
                        Desarmado
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  {agent.performance_level === 'ruim' && (
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 font-bold uppercase tracking-wider">
                      Ruim
                    </Badge>
                  )}
                  {agent.performance_level === 'bom' && (
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200 font-bold uppercase tracking-wider">
                      Bom
                    </Badge>
                  )}
                  {agent.performance_level === 'otimo' && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 font-bold uppercase tracking-wider">
                      Ótimo
                    </Badge>
                  )}
                  <Badge variant={agent.status === 'ativo' ? 'default' : 'outline'} className="text-[10px]">
                    {agent.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CardDescription className="font-mono text-xs">{agent.document}</CardDescription>
                </div>
                {agent.vehicle_plate && (
                  <div className="flex items-center gap-2 mt-1 text-xs font-medium text-muted-foreground">
                    {agent.vehicle_type === 'carro' ? (
                      <Car className="h-3 w-3" />
                    ) : agent.vehicle_type === 'moto' ? (
                      <Bike className="h-3 w-3" />
                    ) : null}
                    <span className="uppercase">{agent.vehicle_plate}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{agent.phone}</span>
                </div>
                {agent.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{agent.email}</span>
                  </div>
                )}
                <RoleGuard allowedRoles={['admin', 'operador']}>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(agent.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 px-0"
                      onClick={(e) => handleDeleteClick(agent.id, e)}
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

      <NewAgentDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={fetchAgents}
      />

      <EditAgentDialog
        agentId={selectedAgentId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchAgents}
      />

      <DeleteAlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Agente"
        description="Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita."
        loading={deleteLoading}
      />
    </div>
  );
};

export default Agents;
