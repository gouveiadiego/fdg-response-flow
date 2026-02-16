import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Truck, Building2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { NewVehicleDialog } from '@/components/vehicles/NewVehicleDialog';
import { EditVehicleDialog } from '@/components/vehicles/EditVehicleDialog';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';

interface Vehicle {
  id: string;
  client_id: string;
  description: string;
  plate_main: string;
  tractor_plate: string | null;
  tractor_brand: string | null;
  tractor_model: string | null;
  trailer1_plate: string | null;
  trailer1_body_type: string | null;
  trailer2_plate: string | null;
  trailer2_body_type: string | null;
  trailer3_plate: string | null;
  trailer3_body_type: string | null;
  color: string | null;
  year: number | null;
  clients: {
    name: string;
  };
}

interface Client {
  id: string;
  name: string;
}

const bodyTypeLabels: Record<string, string> = {
  grade_baixa: 'Grade Baixa',
  grade_alta: 'Grade Alta',
  bau: 'Baú',
  sider: 'Sider',
  frigorifico: 'Frigorífico',
  container: 'Container',
  prancha: 'Prancha',
};

const Vehicles = () => {
  const [searchParams] = useSearchParams();
  const clientFilter = searchParams.get('client');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(clientFilter || 'all');
  const [loading, setLoading] = useState(true);
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (clientFilter) {
      setSelectedClientId(clientFilter);
    }
  }, [clientFilter]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          clients (
            name
          )
        `)
        .order('description');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Erro ao buscar veículos:', error);
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setEditVehicleOpen(true);
  };

  const handleDeleteClick = (vehicleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVehicleToDelete(vehicleId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return;

    setDeleteLoading(true);
    try {
      // Check for tickets
      const { count: ticketsCount, error: ticketsError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', vehicleToDelete);

      if (ticketsError) throw ticketsError;

      if (ticketsCount && ticketsCount > 0) {
        toast.error(`Não é possível excluir: Veículo possui ${ticketsCount} chamado(s) registrado(s). Exclua os chamados primeiro.`);
        return;
      }

      const { error, count } = await supabase
        .from('vehicles')
        .delete({ count: 'exact' })
        .eq('id', vehicleToDelete);

      if (error) throw error;

      if (count === 0) {
        toast.error('Erro: Veículo não encontrado ou permissão negada.');
      } else {
        toast.success('Veículo excluído com sucesso');
        setVehicles(vehicles.filter(v => v.id !== vehicleToDelete));
        fetchVehicles();
      }
    } catch (error: any) {
      console.error('Erro ao excluir veículo:', error);
      if (error.code === '23503') {
        toast.error('Não é possível excluir este veículo pois existem registros vinculados.');
      } else {
        toast.error('Erro ao excluir veículo.');
      }
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (vehicle.description || '').toLowerCase().includes(searchLower) ||
      (vehicle.plate_main || '').toLowerCase().includes(searchLower) ||
      (vehicle.tractor_plate || '').toLowerCase().includes(searchLower);

    const matchesClient = selectedClientId === 'all' || vehicle.client_id === selectedClientId;

    return matchesSearch && matchesClient;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando veículos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Veículos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os veículos dos clientes</p>
        </div>
        <Button onClick={() => setNewVehicleOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Veículo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum veículo encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || selectedClientId !== 'all'
                ? 'Tente buscar com outros termos ou filtros'
                : 'Comece cadastrando um novo veículo'}
            </p>
            {!searchTerm && selectedClientId === 'all' && (
              <Button onClick={() => setNewVehicleOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Veículo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{vehicle.description}</span>
                </CardTitle>
                <CardDescription className="truncate">
                  {vehicle.clients?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Placa principal: <span className="font-mono">{vehicle.plate_main}</span></p>
                  {vehicle.tractor_plate && (
                    <p className="text-xs text-muted-foreground">
                      Cavalo: <span className="font-mono">{vehicle.tractor_plate}</span>
                      {vehicle.tractor_brand && ` - ${vehicle.tractor_brand}`}
                      {vehicle.tractor_model && ` ${vehicle.tractor_model}`}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {vehicle.trailer1_plate && (
                    <Badge variant="outline" className="text-xs">
                      {vehicle.trailer1_plate}
                      {vehicle.trailer1_body_type && ` (${bodyTypeLabels[vehicle.trailer1_body_type] || vehicle.trailer1_body_type})`}
                    </Badge>
                  )}
                  {vehicle.trailer2_plate && (
                    <Badge variant="outline" className="text-xs">
                      {vehicle.trailer2_plate}
                      {vehicle.trailer2_body_type && ` (${bodyTypeLabels[vehicle.trailer2_body_type] || vehicle.trailer2_body_type})`}
                    </Badge>
                  )}
                  {vehicle.trailer3_plate && (
                    <Badge variant="outline" className="text-xs">
                      {vehicle.trailer3_plate}
                      {vehicle.trailer3_body_type && ` (${bodyTypeLabels[vehicle.trailer3_body_type] || vehicle.trailer3_body_type})`}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(vehicle.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-10 px-0"
                    onClick={(e) => handleDeleteClick(vehicle.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        onSuccess={fetchVehicles}
        preselectedClientId={selectedClientId !== 'all' ? selectedClientId : undefined}
      />

      <EditVehicleDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        vehicleId={selectedVehicleId}
        onSuccess={fetchVehicles}
      />

      <DeleteAlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Veículo"
        description="Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita."
        loading={deleteLoading}
      />
    </div>
  );
};

export default Vehicles;
