import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center mb-6 gap-3">
          <Shield className="h-16 w-16 text-primary" />
          <div className="text-left">
            <h1 className="text-5xl font-bold text-foreground">FDG</h1>
            <p className="text-lg text-muted-foreground">Pronta Resposta</p>
          </div>
        </div>
        
        <h2 className="mb-4 text-3xl font-bold text-foreground">
          Sistema de Gestão de Chamados
        </h2>
        <p className="mb-8 text-lg text-muted-foreground">
          Gerencie atendimentos, clientes e agentes de forma profissional e eficiente
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate('/auth')}>
            Acessar Sistema
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 rounded-lg bg-card border">
            <h3 className="font-semibold mb-2 text-foreground">Gestão de Chamados</h3>
            <p className="text-sm text-muted-foreground">
              Controle completo de todos os atendimentos com rastreamento em tempo real
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <h3 className="font-semibold mb-2 text-foreground">Base de Clientes</h3>
            <p className="text-sm text-muted-foreground">
              Cadastro detalhado de clientes, veículos e informações de contato
            </p>
          </div>
          <div className="p-4 rounded-lg bg-card border">
            <h3 className="font-semibold mb-2 text-foreground">Equipe de Agentes</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie sua equipe de agentes e acompanhe os atendimentos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
