import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapPin, CheckCircle, Trash2, MapPinOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { NewDemandDialog } from './NewDemandDialog';
import { RoleGuard } from '@/components/RoleGuard';
import { format } from 'date-fns';

interface AgentDemand {
  id: string;
  created_at: string;
  city: string;
  state: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  status: 'pendente' | 'resolvida';
  resolved_at: string | null;
}

interface AgentDemandsListProps {
  onAgentFound?: (data: { city: string; state: string; address: string | null; latitude: number | null; longitude: number | null }) => void;
}

export function AgentDemandsList({ onAgentFound }: AgentDemandsListProps) {
  const [demands, setDemands] = useState<AgentDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<AgentDemand | null>(null);

  useEffect(() => {
    fetchDemands();
  }, []);

  const fetchDemands = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_demands')
        .select('*')
        .order('status', { ascending: true }) // pendente first
        .order('created_at', { ascending: false }); // newest first

      if (error) {
        // Ignorar o log de erro se for 42P01 (relation does not exist) para não sujar o console
        // caso uma migração ainda não tenha sido rodada localmente
        if (error.code !== '42P01') {
          console.error(error);
        }
        return;
      }
      setDemands(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (demand: AgentDemand) => {
    try {
      const { error } = await supabase
        .from('agent_demands')
        .update({ status: 'resolvida', resolved_at: new Date().toISOString() })
        .eq('id', demand.id);

      if (error) throw error;
      toast.success('Demanda marcada como resolvida!');
      fetchDemands();
      if (onAgentFound) {
        onAgentFound({
          city: demand.city,
          state: demand.state,
          address: demand.address,
          latitude: demand.latitude,
          longitude: demand.longitude,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao atualizar demanda');
    }
  };

  const deleteDemand = async (demandId: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este registro?')) return;
    
    try {
      const { error } = await supabase
        .from('agent_demands')
        .delete()
        .eq('id', demandId);

      if (error) throw error;
      toast.success('Registro apagado com sucesso');
      fetchDemands();
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao deletar demanda');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando mapa de captação...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Demandas de Captação</h2>
          <p className="text-sm text-muted-foreground">
            Locais onde precisamos encontrar novos agentes para a operação.
          </p>
        </div>
        <RoleGuard allowedRoles={['admin', 'operador']}>
          <Button onClick={() => setNewDialogOpen(true)} variant="destructive">
            <MapPin className="h-4 w-4 mr-2" />
            + Registrar Falta
          </Button>
        </RoleGuard>
      </div>

      {demands.length === 0 ? (
        <Card className="border-dashed bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPinOff className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhuma demanda pendente</p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              Sua cobertura está perfeita! Se precisar de um agente num local vazio, registre aqui para lembrar de procurar depois.
            </p>
            <RoleGuard allowedRoles={['admin', 'operador']}>
              <Button onClick={() => setNewDialogOpen(true)} variant="outline">
                Registrar Necessidade
              </Button>
            </RoleGuard>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local / Cidade</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Data do Registro</TableHead>
                <TableHead>Status</TableHead>
                <RoleGuard allowedRoles={['admin', 'operador']}>
                  <TableHead className="text-right">Ações</TableHead>
                </RoleGuard>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demands.map((demand) => (
                <TableRow key={demand.id} className={demand.status === 'resolvida' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-medium">
                        <MapPin className={`h-4 w-4 ${demand.status === 'pendente' ? 'text-destructive' : 'text-muted-foreground'}`} />
                        {demand.city} - {demand.state}
                      </div>
                      {demand.address && (
                        <div className="text-xs text-muted-foreground ml-6 mt-0.5 truncate max-w-[250px]" title={demand.address}>
                          {demand.address}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={demand.notes || ''}>
                    {demand.notes || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(demand.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {demand.status === 'pendente' ? (
                      <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent">
                        Buscando
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent">
                        Resolvido
                      </Badge>
                    )}
                  </TableCell>
                  <RoleGuard allowedRoles={['admin', 'operador']}>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {demand.status === 'pendente' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => markAsResolved(demand)}
                            title="Marcar como resolvido"
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Achei Agente
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditingDemand(demand);
                            setNewDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteDemand(demand.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </RoleGuard>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewDemandDialog 
        open={newDialogOpen} 
        onOpenChange={(open) => {
          setNewDialogOpen(open);
          if (!open) setEditingDemand(null);
        }} 
        onSuccess={fetchDemands} 
        editingDemand={editingDemand}
      />
    </div>
  );
}
