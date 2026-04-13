import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Clients from "./pages/Clients";
import Agents from "./pages/Agents";
import Vehicles from "./pages/Vehicles";
import Plans from "./pages/Plans";
import Operators from "./pages/Operators";
import Performance from "./pages/Performance";
import Financeiro from "./pages/Financeiro";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import AgentRegistration from "./pages/AgentRegistration";
import CustomerTracking from "./pages/CustomerTracking";
import PendingApproval from "./pages/PendingApproval";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAUpdateBanner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/cadastro-agente" element={<AgentRegistration />} />
              <Route path="/acompanhamento/:id" element={<CustomerTracking />} />
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/performance" element={<ProtectedRoute requireAdmin><Performance /></ProtectedRoute>} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/plans" element={<ProtectedRoute requireAdmin><Plans /></ProtectedRoute>} />
                <Route path="/operators" element={<ProtectedRoute requireAdmin><Operators /></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute requireAdmin><Financeiro /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
