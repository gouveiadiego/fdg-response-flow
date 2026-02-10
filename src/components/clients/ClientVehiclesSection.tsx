import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, Pencil } from 'lucide-react';
import { NewVehicleDialog } from '@/components/vehicles/NewVehicleDialog';
import { EditVehicleDialog } from '@/components/vehicles/EditVehicleDialog';

interface Vehicle {
  id: string;
  description: string;
  tractor_plate: string | null;
  tractor_brand: string | null;
  tractor_model: string | null;
  trailer1_plate: string | null;
  trailer1_body_type: string | null;
  trailer2_plate: string | null;
  trailer2_body_type: string | null;
  trailer3_plate: string | null;
  trailer3_body_type: string | null;
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

interface ClientVehiclesSectionProps {
  clientId: string;
}

export function ClientVehiclesSection({ clientId }: ClientVehiclesSectionProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, [clientId]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, description, tractor_plate, tractor_brand, tractor_model, trailer1_plate, trailer1_body_type, trailer2_plate, trailer2_body_type, trailer3_plate, trailer3_body_type')
        .eq('client_id', clientId)
        .order('description');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Erro ao buscar veículos:', error);
    }
  };

  const handleEdit = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setEditVehicleOpen(true);
  };

  return (
    <div className="pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Veículos ({vehicles.length})
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setNewVehicleOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum veículo cadastrado para este cliente
        </p>
      ) : (
        <div className="space-y-2">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-medium truncate">{vehicle.description}</p>
                {vehicle.tractor_plate && (
                  <p className="text-xs text-muted-foreground">
                    Cavalo: <span className="font-mono">{vehicle.tractor_plate}</span>
                    {vehicle.tractor_brand && ` - ${vehicle.tractor_brand}`}
                    {vehicle.tractor_model && ` ${vehicle.tractor_model}`}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {vehicle.trailer1_plate && (
                    <Badge variant="outline" className="text-xs">
                      C1: {vehicle.trailer1_plate}
                      {vehicle.trailer1_body_type && ` (${bodyTypeLabels[vehicle.trailer1_body_type] || vehicle.trailer1_body_type})`}
                    </Badge>
                  )}
                  {vehicle.trailer2_plate && (
                    <Badge variant="outline" className="text-xs">
                      C2: {vehicle.trailer2_plate}
                      {vehicle.trailer2_body_type && ` (${bodyTypeLabels[vehicle.trailer2_body_type] || vehicle.trailer2_body_type})`}
                    </Badge>
                  )}
                  {vehicle.trailer3_plate && (
                    <Badge variant="outline" className="text-xs">
                      C3: {vehicle.trailer3_plate}
                      {vehicle.trailer3_body_type && ` (${bodyTypeLabels[vehicle.trailer3_body_type] || vehicle.trailer3_body_type})`}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => handleEdit(vehicle.id)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        onSuccess={fetchVehicles}
        preselectedClientId={clientId}
      />

      <EditVehicleDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        vehicleId={selectedVehicleId}
        onSuccess={fetchVehicles}
      />
    </div>
  );
}
