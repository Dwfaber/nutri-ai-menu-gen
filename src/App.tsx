
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
import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/Dashboard";
import Cardapios from "./pages/Cardapios";
import Compras from "./pages/Compras";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import SystemArchitecture from "./pages/SystemArchitecture";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
        <ClientContractsProvider>
          <SelectedClientProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/*" element={
                    <ClientSelectionWrapper>
                      <div className="flex min-h-screen w-full bg-gray-50">
                        <Sidebar />
                        <div className="flex-1 flex flex-col">
                          <UserHeader />
                          <main className="flex-1 p-6 overflow-auto">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/cardapios" element={<Cardapios />} />
                            <Route path="/compras" element={<Compras />} />
                            <Route path="/relatorios" element={<Relatorios />} />
                            <Route path="/arquitetura" element={<SystemArchitecture />} />
                            <Route path="/configuracoes" element={<Dashboard />} />
                            <Route path="/welcome" element={<Index />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                          </main>
                        </div>
                      </div>
                    </ClientSelectionWrapper>
                } />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </SelectedClientProvider>
        </ClientContractsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
