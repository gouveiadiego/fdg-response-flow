import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Building2, MapPin, Trash2, FileSpreadsheet, CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { NewClientDialog } from '@/components/clients/NewClientDialog';
import { EditClientDialog } from '@/components/clients/EditClientDialog';
import { Badge } from '@/components/ui/badge';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';
import { exportClientsToExcel } from '@/utils/exportClientsToExcel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ClientStatus = 'ativo' | 'inativo' | 'pre_cadastro';

interface Client {
  id: string;
  name: string;
  document: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  notes: string | null;
  status: ClientStatus;
  vehicles: { plate_main: string }[];
}

const statusConfig: Record<ClientStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ativo: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
  inativo: { label: 'Inativo', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="h-3 w-3" /> },
  pre_cadastro: { label: 'Pré-cadastro', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <UserPlus className="h-3 w-3" /> },
};

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClientStatus>('ativo');

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, document, contact_name, contact_phone, contact_email, cep, street, street_number, neighborhood, city, state, notes, status, vehicles(plate_main)')
        .order('name');

      if (error) throw error;
      setClients((data || []) as any);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (clientId: string) => {
    setSelectedClientId(clientId);
    setEditClientOpen(true);
  };

  const handleDeleteClick = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClientToDelete(clientId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleteLoading(true);
    try {
      const { data: clientVehicles, error: vehiclesError } = await supabase
        .from('vehicles').select('id, plate_main').eq('client_id', clientToDelete);
      if (vehiclesError) throw vehiclesError;
      
      const isAlarmeOnly = clientVehicles && clientVehicles.length === 1 && clientVehicles[0].plate_main === 'ALARME';

      if (clientVehicles && clientVehicles.length > 0 && !isAlarmeOnly) {
        toast.error(`Não é possível excluir: Cliente possui ${clientVehicles.length} veículo(s). Exclua os veículos primeiro.`);
        return;
      }

      const { count: ticketsCount, error: ticketsError } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true }).eq('client_id', clientToDelete);
      if (ticketsError) throw ticketsError;
      if (ticketsCount && ticketsCount > 0) {
        toast.error(`Não é possível excluir: Cliente possui ${ticketsCount} chamado(s). Exclua os chamados primeiro.`);
        return;
      }

      if (isAlarmeOnly) {
        await supabase.from('vehicles').delete().eq('id', clientVehicles[0].id);
      }

      const { error, count } = await supabase.from('clients').delete({ count: 'exact' }).eq('id', clientToDelete);
      if (error) throw error;
      if (count === 0) {
        toast.error('Erro: Cliente não encontrado ou permissão negada.');
      } else {
        toast.success('Cliente excluído com sucesso');
        setClients(clients.filter(c => c.id !== clientToDelete));
        fetchClients();
      }
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    try {
      const { error } = await supabase.from('clients').update({ status: newStatus } as any).eq('id', clientId);
      if (error) throw error;
      const statusLabel = statusConfig[newStatus].label;
      toast.success(`Cliente alterado para ${statusLabel}`);
      fetchClients();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do cliente');
    }
  };

  const handleExportExcel = () => {
    if (clients.length === 0) {
      toast.error('Nenhum cliente para exportar');
      return;
    }
    const toExport = filteredClients.length > 0 ? filteredClients : clients;
    exportClientsToExcel(toExport);
    toast.success(`${toExport.length} cliente(s) exportado(s) com sucesso!`);
  };

  const handleViewVehicles = (clientId: string) => {
    navigate(`/vehicles?client=${clientId}`);
  };

  const filteredClients = clients
    .filter(c => c.status === activeTab)
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const countByStatus = (s: ClientStatus) => clients.filter(c => c.status === s).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie os clientes do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={() => setNewClientOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Tabs de status */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClientStatus)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ativo" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Ativos
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{countByStatus('ativo')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pre_cadastro" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Pré-cadastro
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{countByStatus('pre_cadastro')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inativo" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            Inativos
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{countByStatus('inativo')}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum cliente encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? 'Tente buscar com outros termos' : `Nenhum cliente ${statusConfig[activeTab].label.toLowerCase()} cadastrado`}
            </p>
            {!searchTerm && (
              <Button onClick={() => setNewClientOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{client.name}</span>
                  {client.vehicles?.some(v => v.plate_main === 'ALARME') && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] px-1.5 py-0 h-4">ALARME</Badge>
                  )}
                </CardTitle>
                <CardDescription className="font-mono text-xs">{client.document}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {[client.neighborhood, client.city, client.state].filter(Boolean).join(', ') || `${client.city}, ${client.state}`}
                  </span>
                </div>
                {client.contact_phone && (
                  <p className="text-sm text-muted-foreground truncate">{client.contact_phone}</p>
                )}
                {/* Botões de ação de status */}
                <div className="flex gap-1.5 pt-1">
                  {activeTab === 'pre_cadastro' && (
                    <Button
                      variant="outline" size="sm"
                      className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 text-xs h-7"
                      onClick={() => handleStatusChange(client.id, 'ativo')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Ativar
                    </Button>
                  )}
                  {activeTab === 'ativo' && (
                    <Button
                      variant="outline" size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-7"
                      onClick={() => handleStatusChange(client.id, 'inativo')}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Inativar
                    </Button>
                  )}
                  {activeTab === 'inativo' && (
                    <Button
                      variant="outline" size="sm"
                      className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 text-xs h-7"
                      onClick={() => handleStatusChange(client.id, 'ativo')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Reativar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewVehicles(client.id)}>
                    Ver Veículos
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(client.id)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 px-0"
                    onClick={(e) => handleDeleteClick(client.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} onSuccess={fetchClients} />
      <EditClientDialog open={editClientOpen} onOpenChange={setEditClientOpen} clientId={selectedClientId} onSuccess={fetchClients} />
      <DeleteAlertDialog
        open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Isso pode falhar se houver registros vinculados."
        loading={deleteLoading}
      />
    </div>
  );
};

export default Clients;