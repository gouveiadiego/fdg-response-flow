import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, UserCheck, Phone, Mail, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { NewAgentDialog } from '@/components/agents/NewAgentDialog';
import { EditAgentDialog } from '@/components/agents/EditAgentDialog';
import { RoleGuard } from '@/components/RoleGuard';

interface Agent {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string | null;
  status: 'ativo' | 'inativo';
  is_armed: boolean | null;
}

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, document, phone, email, status, is_armed')
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
                <div className="flex items-center gap-2">
                  <CardDescription className="font-mono text-xs">{agent.document}</CardDescription>
                  <Badge variant={agent.status === 'ativo' ? 'default' : 'outline'}>
                    {agent.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
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
    </div>
  );
};

export default Agents;
