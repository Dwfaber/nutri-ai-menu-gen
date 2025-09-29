
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClientContractsProvider } from "@/contexts/ClientContractsContext";
import { SelectedClientProvider } from "@/contexts/SelectedClientContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserHeader } from "@/components/Header/UserHeader";
import { DemoIndicator } from "@/components/ui/demo-indicator";
import Sidebar from "./components/Sidebar/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Cardapios from "./pages/Cardapios";
import Receitas from "./pages/Receitas";
import Compras from "./pages/Compras";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import Updates from "./pages/Updates";
import Configuracoes from "./pages/Configuracoes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import RecipeAudit from "./pages/RecipeAudit";
import ClientSelectionWrapper from "./components/ClientSelection/ClientSelectionWrapper";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ClientContractsProvider>
            <SelectedClientProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <DemoIndicator />
                <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/*" element={
                  <ProtectedRoute requireRole="viewer" fallbackPath="/auth">
                    <ClientSelectionWrapper>
                      <div className="flex min-h-screen w-full bg-background">
                        <Sidebar />
                        <div className="flex-1 flex flex-col">
                          <UserHeader />
                          <main className="flex-1 p-6 overflow-auto">
                            <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/cardapios" element={<Cardapios />} />
                              <Route path="/receitas" element={<Receitas />} />
                              <Route path="/compras" element={<Compras />} />
                              <Route path="/auditoria" element={<RecipeAudit />} />
                              <Route path="/relatorios" element={<Relatorios />} />
                              <Route path="/atualizacoes" element={<Updates />} />
                              <Route path="/configuracoes" element={<Configuracoes />} />
                              <Route path="/welcome" element={<Index />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </main>
                        </div>
                      </div>
                    </ClientSelectionWrapper>
                  </ProtectedRoute>
                } />
              </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </SelectedClientProvider>
          </ClientContractsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
