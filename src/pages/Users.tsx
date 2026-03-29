import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Shield, UserCog, Mail, Trash2, KeyRound, Check, Clock } from 'lucide-react';
import { DeleteAlertDialog } from '@/components/DeleteAlertDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_approved: boolean;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  agente: 'Agente',
  cliente_visualizacao: 'Cliente (Visualização)',
};

const roleColors: Record<string, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  operador: 'bg-primary text-primary-foreground',
  agente: 'bg-info text-info-foreground',
  cliente_visualizacao: 'bg-muted text-muted-foreground',
};

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Password state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email');

      if (profilesError) {
        console.error('Erro ao buscar perfis:', profilesError);
        throw profilesError;
      }

      // 2. Fetch all user roles (Admins can see everything due to RLS)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, is_approved');

      if (rolesError) {
        console.error('Erro ao buscar funções (user_roles):', rolesError);
        // If roles fail, we'll continue with defaults
      }

      // 3. Merge in memory
      const formattedUsers = profilesData.map((profile) => {
        const userRole = rolesData?.find(r => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          role: userRole?.role || 'operador',
          is_approved: userRole?.is_approved ?? false,
        };
      });

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Erro geral ao buscar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Check current role first to see if we need to update or insert
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      let error;
      if (existingRole) {
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: newRole as any })
          .eq('user_id', userId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role: newRole as any }]);
        error = insertError;
      }

      if (error) throw error;

      toast.success('Permissão atualizada com sucesso');
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    }
  };

  const handleDeleteClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToDelete(userId);
    setDeleteDialogOpen(true);
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_approved: true })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuário aprovado com sucesso!');
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao aprovar usuário:', error);
      toast.error('Erro ao aprovar usuário');
    }
  };

  const handlePasswordClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToChangePassword(userId);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogOpen(true);
  };

  const handleConfirmPasswordChange = async () => {
    if (!userToChangePassword || !newPassword || !confirmPassword) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setPasswordLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_change_password' as any, {
        target_user_id: userToChangePassword,
        new_password: newPassword
      });

      if (error) throw error;
      
      // Agora o data é um objeto { success, message, tried_id? }
      if (data && data.success) {
        toast.success(data.message || 'Senha alterada com sucesso');
        setPasswordDialogOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const msg = data?.message || 'Erro desconhecido';
        const detail = data?.tried_id ? ` (ID: ${data.tried_id})` : '';
        toast.error(msg + detail);
      }
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast.error(error.message || 'Erro ao comunicar com o servidor');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.rpc('delete_user' as any, {
        target_user_id: userToDelete
      });

      if (error) throw error;

      toast.success('Usuário removido com sucesso');
      setUsers(users.filter(u => u.user_id !== userToDelete));
    } catch (error: any) {
      console.error('Erro ao remover usuário:', error);
      toast.error(error.message || 'Erro ao remover usuário');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserCog className="h-8 w-8 text-primary" />
          Gestão de Usuários
        </h1>
        <p className="text-muted-foreground">
          Gerencie permissões e funções dos usuários do sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Apenas administradores podem alterar as funções dos usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold text-foreground">Nome</TableHead>
                  <TableHead className="font-bold text-foreground">E-mail</TableHead>
                  <TableHead className="font-bold text-foreground">Função Atual</TableHead>
                  <TableHead className="text-right font-bold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={roleColors[user.role]}>
                          {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {roleLabels[user.role]}
                        </Badge>
                        {!user.is_approved && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 text-[10px] py-0 h-4 w-fit flex items-center gap-1">
                            <Clock className="h-2 w-2" />
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_approved && (
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 gap-1 px-3 text-xs"
                            onClick={() => handleApproveUser(user.user_id)}
                          >
                            <Check className="h-3 w-3" />
                            Aprovar
                          </Button>
                        )}
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.user_id, value as any)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Alterar função" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value} className="text-xs">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost" 
                          size="sm"
                          className="text-primary hover:bg-primary/10 w-8 h-8 p-0"
                          title="Alterar Senha"
                          onClick={(e) => handlePasswordClick(user.user_id, e)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive w-8 h-8 p-0"
                          title="Excluir Usuário"
                          onClick={(e) => handleDeleteClick(user.user_id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <DeleteAlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onConfirm={handleConfirmDelete}
              title="Remover Usuário"
              description="Tem certeza que deseja remover este usuário? Esta ação excluirá a conta permanentemente e não pode ser desfeita."
              loading={deleteLoading}
            />

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Alterar Senha</DialogTitle>
                  <DialogDescription>
                    Digite a nova senha para este usuário. Ele precisará usar esta nova senha no próximo login.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="password">Nova Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive font-medium italic">As senhas não coincidem.</p>
                    )}
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={passwordLoading} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleConfirmPasswordChange} 
                    disabled={passwordLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                    className="w-full sm:w-auto"
                  >
                    {passwordLoading ? 'Alterando...' : 'Confirmar e Salvar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </div>
        </CardContent>
      </Card>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-500" />
          <div className="text-sm text-blue-700">
            <p className="font-bold">Dica de Segurança</p>
            <p>Novos usuários que se cadastrarem no sistema entram automaticamente com a função de <strong>Operador</strong>. Você pode promovê-los aqui.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
