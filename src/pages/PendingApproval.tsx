import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, ShieldAlert, Clock, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PendingApproval = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-950 text-white overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      
      <div className="z-10 w-full max-w-lg">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl space-y-8 text-center">
          <div className="relative inline-block">
            <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
              <Clock className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-2 border-4 border-slate-950">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              Acesso em Análise
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Recebemos seu cadastro! Por segurança, sua conta precisa ser aprovada por um administrador da <span className="text-primary font-bold">Falco Peregrinus</span> antes de acessar o sistema.
            </p>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-2">
            <p className="text-sm font-semibold text-slate-300">O que fazer agora?</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Entre em contato com o gestor da sua unidade ou peça para um administrador liberar seu acesso na aba "Usuários".
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              onClick={handleRefresh}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-all hover:scale-[1.02] active:scale-95 gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Já fui aprovado
            </Button>
            <Button 
              variant="outline"
              onClick={handleLogout}
              className="flex-1 h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all hover:scale-[1.02] active:scale-95 gap-2"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} FDG - Falco Peregrinus. Gestão de Resposta Rápida.
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
