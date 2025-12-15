import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { NewPlanDialog } from '@/components/plans/NewPlanDialog';
import { EditPlanDialog } from '@/components/plans/EditPlanDialog';

interface Plan {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

const Plans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('name');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (planId: string) => {
    setSelectedPlanId(planId);
    setEditPlanOpen(true);
  };

  const filteredPlans = plans.filter((plan) =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Planos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os planos operacionais</p>
        </div>
        <Button onClick={() => setNewPlanOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar plano por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Nenhum plano encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? 'Tente buscar com outros termos' : 'Comece cadastrando um novo plano'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setNewPlanOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Plano
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{plan.name}</span>
                </CardTitle>
                {plan.category && (
                  <CardDescription className="text-xs">{plan.category}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(plan.id)}
                  >
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewPlanDialog 
        open={newPlanOpen} 
        onOpenChange={setNewPlanOpen}
        onSuccess={fetchPlans}
      />

      <EditPlanDialog
        open={editPlanOpen}
        onOpenChange={setEditPlanOpen}
        planId={selectedPlanId}
        onSuccess={fetchPlans}
      />
    </div>
  );
};

export default Plans;
