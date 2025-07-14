import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/Dashboard";
import Cardapios from "./pages/Cardapios";
import Compras from "./pages/Compras";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";
import SystemArchitecture from "./pages/SystemArchitecture";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex min-h-screen w-full bg-gray-50">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cardapios" element={<Cardapios />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/arquitetura" element={<SystemArchitecture />} />
              <Route path="/configuracoes" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
