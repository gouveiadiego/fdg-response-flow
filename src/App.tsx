import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
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
import NotFound from "./pages/NotFound";
import AgentRegistration from "./pages/AgentRegistration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/cadastro-agente" element={<AgentRegistration />} />
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/operators" element={<Operators />} />
                <Route path="/financeiro" element={<Financeiro />} />
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
