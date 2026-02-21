import { Home, Users, UserCheck, FileText, LogOut, Truck, ClipboardList, TrendingUp, DollarSign } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { ModeToggle } from '@/components/ModeToggle';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'Desempenho', url: '/performance', icon: TrendingUp },
  { title: 'Chamados', url: '/tickets', icon: FileText },
  { title: 'Clientes', url: '/clients', icon: Users },
  { title: 'Veículos', url: '/vehicles', icon: Truck },
  { title: 'Agentes', url: '/agents', icon: UserCheck },
  { title: 'Operadores', url: '/operators', icon: Users },
  { title: 'Financeiro', url: '/financeiro', icon: DollarSign },
  { title: 'Planos', url: '/plans', icon: ClipboardList },
];

export function AppSidebar() {
  const { open, setOpenMobile } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  const handleNavClick = () => {
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img src="/logo-fdg-premium.png" alt="Logo" className="h-8 w-auto" />
            {open && (
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">FDG</span>
                <span className="text-[10px] leading-none text-muted-foreground flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  Pronta Resposta
                </span>
              </div>
            )}
          </div>
          {open && <ModeToggle />}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
