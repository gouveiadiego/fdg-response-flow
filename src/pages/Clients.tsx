import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Building2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { NewClientDialog } from '@/components/clients/NewClientDialog';
import { EditClientDialog } from '@/components/clients/EditClientDialog';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';

interface Client {
  id: string;
  name: string;
  document: string;
  city: string;
  state: string;
  contact_phone: string | null;
}

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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
        .select('id, name, document, city, state, contact_phone')
        .order('name');

      if (error) throw error;
      setClients(data || []);
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
      // Check for vehicles
      const { count: vehiclesCount, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientToDelete);

      if (vehiclesError) throw vehiclesError;

      if (vehiclesCount && vehiclesCount > 0) {
        toast.error(`Não é possível excluir: Cliente possui ${vehiclesCount} veículo(s) cadastrado(s). Exclua os veículos primeiro.`);
        return;
      }

      // Check for tickets
      const { count: ticketsCount, error: ticketsError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientToDelete);

      if (ticketsError) throw ticketsError;

      if (ticketsCount && ticketsCount > 0) {
        toast.error(`Não é possível excluir: Cliente possui ${ticketsCount} chamado(s) registrado(s). Exclua os chamados primeiro.`);
        return;
      }

      const { error, count } = await supabase
        .from('clients')
        .delete({ count: 'exact' })
        .eq('id', clientToDelete);

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

  const handleViewVehicles = (clientId: string) => {
    navigate(`/vehicles?client=${clientId}`);
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <Button onClick={() => setNewClientOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

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
              {searchTerm ? 'Tente buscar com outros termos' : 'Comece cadastrando um novo cliente'}
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
                </CardTitle>
                <CardDescription className="font-mono text-xs">{client.document}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{client.city}, {client.state}</span>
                </div>
                {client.contact_phone && (
                  <p className="text-sm text-muted-foreground truncate">{client.contact_phone}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewVehicles(client.id)}
                  >
                    Ver Veículos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(client.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
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

      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onSuccess={fetchClients}
      />

      <EditClientDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        clientId={selectedClientId}
        onSuccess={fetchClients}
      />

      <DeleteAlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Isso pode falhar se houver registros vinculados."
        loading={deleteLoading}
      />
    </div>
  );
};

export default Clients;
