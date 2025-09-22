import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptimizationSettings } from "@/components/Optimization";
import { Settings, Zap, User, Globe } from "lucide-react";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      </div>
      
      <Tabs defaultValue="optimization" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="optimization" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Otimização
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Sistema
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Avançado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="space-y-6">
          <OptimizationSettings />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Perfil</CardTitle>
              <CardDescription>
                Gerencie suas informações pessoais e preferências de conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Em desenvolvimento - configurações de perfil serão implementadas em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>
                Configure preferências gerais do sistema e integrações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Em desenvolvimento - configurações de sistema serão implementadas em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Avançadas</CardTitle>
              <CardDescription>
                Funcionalidades avançadas do sistema foram movidas para seções específicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">📊 Gestão de Custos de Receitas</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    O sistema de recálculo de custos foi integrado diretamente na análise de receitas.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acesse: <strong>Receitas → Diagnóstico Detalhado</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}