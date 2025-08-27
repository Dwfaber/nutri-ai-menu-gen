import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, Code, Database, Cpu, GitBranch, Zap, Bug, Plus, Calendar } from "lucide-react";

export default function Updates() {
  const recentUpdates = [
    {
      date: "27/08/2024",
      title: "Sistema de Custos Corrigido",
      description: "Correção crítica no cálculo de custos por refeição",
      type: "bug-fix",
      impact: "crítico",
      details: [
        "Conversões de unidade precisas (KG, G, ML, L, UN)",
        "Validação inteligente para custos altos",
        "Logs detalhados para debug",
        "Tratamento de erros robusto"
      ]
    },
    {
      date: "27/08/2024", 
      title: "Geração de Cardápios Melhorada",
      description: "Expansão da busca e variedade de receitas",
      type: "feature",
      impact: "alto",
      details: [
        "Busca expandida por categorias (carnes, peixes, vegetais)",
        "IDs reais substituindo placeholders temporários",
        "Rotação inteligente de proteínas (PP1/PP2)",
        "Variedade aumentada em todas as categorias"
      ]
    },
    {
      date: "27/08/2024",
      title: "Correção de Erros 500",
      description: "Estabilização da API e funções edge",
      type: "bug-fix", 
      impact: "alto",
      details: [
        "Tratamento robusto de erros na API",
        "Validação de dados antes do processamento", 
        "Logs de debug implementados",
        "Timeout handling melhorado"
      ]
    }
  ];

  const completeHistory = {
    backend: [
      {
        date: "27/08/2024",
        title: "Otimização Edge Functions",
        description: "Melhorias na performance e confiabilidade",
        status: "concluído"
      },
      {
        date: "26/08/2024", 
        title: "Sistema de Custos Refeições",
        description: "Implementação do cálculo preciso de custos",
        status: "concluído"
      },
      {
        date: "25/08/2024",
        title: "Integração GPT Assistant",
        description: "IA para geração automática de cardápios",
        status: "concluído"
      }
    ],
    frontend: [
      {
        date: "27/08/2024",
        title: "Interface de Atualizações",
        description: "Nova aba para acompanhar melhorias",
        status: "concluído"
      },
      {
        date: "26/08/2024",
        title: "Dashboard de Custos",
        description: "Visualização aprimorada de análises",
        status: "concluído"
      },
      {
        date: "25/08/2024",
        title: "Gerador de Cardápios",
        description: "Interface intuitiva para criação",
        status: "concluído"
      }
    ],
    ai: [
      {
        date: "27/08/2024",
        title: "Algoritmo de Rotação",
        description: "IA para balanceamento de proteínas",
        status: "concluído"
      },
      {
        date: "26/08/2024",
        title: "Sugestões Inteligentes",
        description: "Recomendações baseadas em preferências",
        status: "concluído"
      },
      {
        date: "25/08/2024",
        title: "Processamento NLP",
        description: "Interpretação de requisitos em linguagem natural",
        status: "concluído"
      }
    ],
    integrations: [
      {
        date: "27/08/2024",
        title: "Sincronização Legacy",
        description: "Integração com sistema antigo aprimorada",
        status: "concluído"
      },
      {
        date: "26/08/2024",
        title: "Base de Produtos",
        description: "Conectividade com fornecedores",
        status: "concluído"
      },
      {
        date: "25/08/2024",
        title: "Supabase Setup",
        description: "Configuração inicial do banco",
        status: "concluído"
      }
    ]
  };

  const roadmap = [
    {
      title: "Sistema de Notificações",
      description: "Alertas em tempo real para aprovações e alterações",
      status: "planejado",
      priority: "alta",
      quarter: "Q3 2024"
    },
    {
      title: "Relatórios Avançados",
      description: "Analytics detalhados e exportação personalizada",
      status: "em-desenvolvimento",
      priority: "média",
      quarter: "Q4 2024"
    },
    {
      title: "App Mobile",
      description: "Versão mobile para gestores e nutricionistas",
      status: "planejado",
      priority: "alta",
      quarter: "Q1 2025"
    },
    {
      title: "IA Preditiva",
      description: "Previsão de demanda e otimização automática",
      status: "pesquisa",
      priority: "baixa",
      quarter: "Q2 2025"
    }
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug-fix": return <Bug className="h-4 w-4" />;
      case "feature": return <Plus className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "bug-fix": return "destructive";
      case "feature": return "default";
      default: return "secondary";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "crítico": return "destructive";
      case "alto": return "default";
      case "médio": return "secondary";
      default: return "outline";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "backend": return <Database className="h-4 w-4" />;
      case "frontend": return <Code className="h-4 w-4" />;
      case "ai": return <Cpu className="h-4 w-4" />;
      case "integrations": return <GitBranch className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluído": return "default";
      case "em-desenvolvimento": return "secondary";
      case "planejado": return "outline";
      case "pesquisa": return "outline";
      default: return "outline";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta": return "destructive";
      case "média": return "default";
      case "baixa": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Atualizações do Sistema</h1>
          <p className="text-muted-foreground">
            Acompanhe todas as melhorias e novidades do Nutr's IA
          </p>
        </div>
      </div>

      <Tabs defaultValue="recent" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Últimas Atualizações
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Histórico Completo
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Roadmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-6">
          <div className="space-y-4">
            {recentUpdates.map((update, index) => (
              <Card key={index} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getTypeColor(update.type)} className="flex items-center gap-1">
                          {getTypeIcon(update.type)}
                          {update.type === "bug-fix" ? "Correção" : "Funcionalidade"}
                        </Badge>
                        <Badge variant={getImpactColor(update.impact)}>
                          {update.impact}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{update.date}</span>
                      </div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        {update.title}
                      </CardTitle>
                      <CardDescription>{update.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Melhorias implementadas:</h4>
                    <ul className="space-y-1">
                      {update.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(completeHistory).map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 capitalize">
                    {getCategoryIcon(category)}
                    {category === "backend" ? "Backend" : 
                     category === "frontend" ? "Frontend" :
                     category === "ai" ? "Inteligência Artificial" : "Integrações"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{item.title}</h4>
                        <Badge variant={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                      {index < items.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {roadmap.map((item, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge variant={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                      <Badge variant={getPriorityColor(item.priority)}>
                        {item.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {item.quarter}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}