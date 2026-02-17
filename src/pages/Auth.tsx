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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0c10]">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="flex flex-col items-center justify-center mb-8 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-4 bg-primary/10 rounded-2xl backdrop-blur-xl border border-primary/20 shadow-2xl shadow-primary/20">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-1">
              FDG <span className="text-primary">Response</span>
            </h1>
            <p className="text-muted-foreground font-medium">Pronta Resposta Padrão Alto</p>
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 backdrop-blur-md border border-white/10 p-1 h-12">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300"
            >
              Cadastrar
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive-foreground animate-in shake duration-500">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="login" className="mt-0">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <form onSubmit={handleLogin} className="relative z-10">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Bem-vindo de volta</CardTitle>
                  <CardDescription className="text-muted-foreground">Entre com suas credenciais para acessar o painel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-white/80">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="exemplo@email.com"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-primary/50 transition-all"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="login-password" className="text-white/80">Senha</Label>
                      <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">Esqueceu a senha?</button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-primary/50 transition-all"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold gap-2 group transition-all" disabled={isLoading}>
                    {isLoading ? 'Autenticando...' : (
                      <>
                        Entrar no Sistema
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="mt-0">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl">
              <form onSubmit={handleSignup}>
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Criar nova conta</CardTitle>
                  <CardDescription className="text-muted-foreground">Cadastre-se para começar a gerenciar seus chamados</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-white/80">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome completo"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-white/80">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="exemplo@email.com"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-white/80">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold transition-all" disabled={isLoading}>
                    {isLoading ? 'Processando...' : 'Criar minha conta'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-white/40 text-xs mt-8">
          © 2026 FDG Response Flow. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Auth;
