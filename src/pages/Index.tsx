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
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden mesh-gradient">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 text-center max-w-4xl w-full">
        {/* Logo Section */}
        <div className="flex flex-col items-center justify-center mb-10 group">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 group-hover:scale-175 transition-transform duration-500" />
            <img 
              src="/logo-fdg-red.png" 
              alt="Logo" 
              className="relative h-28 w-auto drop-shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-transform duration-500 group-hover:scale-105" 
            />
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter text-white mb-2 uppercase">
              FALCO <span className="text-primary">PEREGRINUS</span>
            </h1>
            <p className="text-sm text-zinc-400 font-bold tracking-[0.3em] uppercase">Operações Logísticas Padrão Alto</p>
          </div>
        </div>
        
        {/* Hero Text */}
        <div className="space-y-6 mb-12">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[0.9]">
            SISTEMA DE GESTÃO <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-primary">DE CHAMADOS</span>
          </h2>
          <p className="max-w-xl mx-auto text-lg text-zinc-400 font-medium leading-relaxed">
            A plataforma definitiva para controle operacional de atendimentos, 
            gestão de rede e inteligência logística em tempo real.
          </p>
        </div>
        
        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="h-14 px-10 text-lg font-black uppercase tracking-widest bg-primary hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            Acessar Sistema
          </Button>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="glass-card p-8 rounded-3xl border border-white/5 group hover:border-primary/30 transition-all duration-300">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-black mb-3 text-white uppercase tracking-tight">Gestão de Chamados</h3>
            <p className="text-sm text-zinc-400 font-medium leading-relaxed">
              Controle absoluto de cada etapa do atendimento com auditoria e rastreamento full-time.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-white/5 group hover:border-primary/30 transition-all duration-300">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <div className="h-6 w-6 border-2 border-primary rounded-full border-t-transparent animate-spin-slow" />
            </div>
            <h3 className="text-xl font-black mb-3 text-white uppercase tracking-tight">Base de Clientes</h3>
            <p className="text-sm text-zinc-400 font-medium leading-relaxed">
              Base de dados otimizada com perfis detalhados de veículos, frotas e contatos estratégicos.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-white/5 group hover:border-primary/30 transition-all duration-300">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <div className="h-6 w-6 bg-primary rounded-lg rotate-45" />
            </div>
            <h3 className="text-xl font-black mb-3 text-white uppercase tracking-tight">Equipe de Agentes</h3>
            <p className="text-sm text-zinc-400 font-medium leading-relaxed">
              Monitoramento de performance, compensação financeira e geolocalização da rede de campo.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-16 text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">
          © 2026 FALCO PEREGRINUS • TECNOLOGIA OPERACIONAL AVANÇADA
        </p>
      </div>
    </div>
  );
};

export default Index;
