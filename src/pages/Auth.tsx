import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Mail, Lock, User, ArrowRight } from 'lucide-react';

const Auth = () => {
  const { signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setError(error.message);
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      setError(error.message);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden mesh-gradient transition-colors duration-500">
      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="flex flex-col items-center justify-center mb-8 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-4 bg-white/5 rounded-3xl backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden group">
            <img 
              src="/logo-fdg-red.png" 
              alt="FDG Logo" 
              className="h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.5)] group-hover:scale-110 transition-transform duration-500" 
            />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter text-white mb-1 uppercase">
              FALCO PEREGRINUS
            </h1>
            <p className="text-zinc-400 font-medium tracking-widest text-xs uppercase">Operações Logísticas Padrão Alto</p>
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 backdrop-blur-md border border-white/10 p-1 h-12 rounded-xl">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300 rounded-lg font-bold"
            >
              ENTRAR
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300 rounded-lg font-bold"
            >
              CADASTRAR
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mb-6 bg-destructive/20 border-destructive/30 text-white animate-in shake duration-500 rounded-xl backdrop-blur-md">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="font-bold">{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="login" className="mt-0">
            <Card className="glass-card border-white/10 rounded-3xl overflow-hidden group transition-all duration-500 hover:border-primary/30">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <form onSubmit={handleLogin} className="relative z-10">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl font-black text-white">BEM-VINDO</CardTitle>
                  <CardDescription className="text-zinc-400 font-medium">Acesse o painel operacional Falco Peregrinus</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary/50 focus:ring-primary/50 transition-all rounded-xl"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <Label htmlFor="login-password" className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Senha</Label>
                      <button type="button" className="text-[10px] text-primary hover:text-primary/80 transition-colors font-black uppercase tracking-widest">Esqueceu a senha?</button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary/50 focus:ring-primary/50 transition-all rounded-xl"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-8">
                  <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black tracking-widest uppercase gap-3 group transition-all rounded-2xl shadow-[0_0_30px_rgba(var(--primary),0.2)]" disabled={isLoading}>
                    {isLoading ? 'AUTENTICANDO...' : (
                      <>
                        ACESSAR SISTEMA
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="mt-0">
            <Card className="glass-card border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:border-primary/30">
              <form onSubmit={handleSignup}>
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-white uppercase">Nova Conta</CardTitle>
                  <CardDescription className="text-zinc-400">Cadastre-se para gerenciar chamados</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary/50 rounded-xl"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary/50 rounded-xl"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest ml-1">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 dígitos"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-primary/50 rounded-xl"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pb-8">
                  <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black tracking-widest uppercase transition-all rounded-2xl shadow-[0_0_30px_rgba(var(--primary),0.2)]" disabled={isLoading}>
                    {isLoading ? 'PROCESSANDO...' : 'CRIAR MINHA CONTA'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-8">
          © 2026 FALCO PEREGRINUS. TODOS OS DIREITOS RESERVADOS.
        </p>
      </div>
    </div>
  );
};

export default Auth;
