import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConnectivityTest } from '@/components/Monitoring/ConnectivityTest';
import { MenuGenerationTestRunner } from '@/components/Testing/MenuGenerationTestRunner';
import { CheckCircle, Clock, Code, Database, Cpu, GitBranch, Zap, Bug, Plus, Calendar, Activity, AlertTriangle } from "lucide-react";

export default function Updates() {
  const recentUpdates = [
    {
      date: "13/10/2025",
      title: "Sistema de Seleção de Sucos Simplificado",
      description: "Refatoração completa da lógica de busca de sucos por categorias corretas",
      type: "bug-fix",
      impact: "crítico",
      details: [
        "Removida toda complexidade de TIPOS_SUCO_CONFIG e filtros de texto",
        "Busca direta por categoria: PRÓ MIX e VITA SUCO em 'Suco 1'/'Suco 2'",
        "NATURAL em categoria 'Bebidas' com filtro 'SUCO NATURAL'",
        "DIET em categoria 'Suco Diet' (todos os itens)",
        "Uso nativo de .ilike() para busca case-insensitive",
        "Eliminação de código de fallback desnecessário",
        "Remoção de duplicatas por receita_id_legado",
        "Código 10x mais simples e confiável"
      ]
    },
    {
      date: "17/09/2025",
      title: "Sistema de Listas de Compras Corrigido",
      description: "Correção completa de listas vazias e normalização de IDs de receitas",
      type: "bug-fix",
      impact: "crítico",
      details: [
        "Normalização automática de IDs de receitas inválidos",
        "Correção de mapeamento receita_id_legado → nome quando necessário",
        "Criação de itens placeholder quando produtos não estão no mercado",
        "Distribuição proporcional de orçamento entre ingredientes estimados",
        "Botão 'Corrigir Itens' para regenerar listas vazias",
        "Indicadores visuais de disponibilidade e notas explicativas",
        "Suporte para atualização de listas existentes via existingListId"
      ]
    },
    {
      date: "07/09/2025",
      title: "Fase 1 - Sistema de Proteínas Categorizadas",
      description: "Nova estrutura baseada em tabelas para classificação automática de proteínas",
      type: "feature",
      impact: "crítico",
      details: [
        "Criação da tabela proteinas_disponiveis com 371 receitas categorizadas",
        "Classificação automática por tipos: carne vermelha, suína, frango, peixe, ovo, vegetariano",
        "Subcategorias principal_1 e principal_2 implementadas",
        "Configuração personalizada por cliente via useProteinConfiguration",
        "Eliminação de erros de classificação por regex",
        "Compatibilidade completa com sistema legacy mantida",
        "Hook useProteinConfiguration implementado com filtros avançados"
      ]
    },
    {
      date: "02/09/2025",
      title: "Sistema de Orçamento Dinâmico",
      description: "Orçamento específico por filial implementado substituindo valor fixo",
      type: "feature",
      impact: "crítico",
      details: [
        "Busca automática do orçamento da filial na tabela custos_filiais",
        "Eliminação da constante hardcoded MAX_MEAL_COST",
        "Fallback para R$ 9,00 quando não há dados específicos",
        "Transparência total com origem do orçamento (tabela vs fallback)",
        "Substituições detalhadas com economia calculada",
        "Logs informativos para auditoria completa"
      ]
    },
    {
      date: "02/09/2025",
      title: "Estrutura de Cardápios Completa",
      description: "Sistema agora gera cardápios com 10 categorias fixas sem duplicação",
      type: "feature",
      impact: "crítico",
      details: [
        "Estrutura fixa: PP1, PP2, Arroz, Feijão, Guarnição, Salada 1, Salada 2, Suco 1, Suco 2, Sobremesa",
        "Eliminação completa de duplicação de categorias",
        "Slots sempre preenchidos sem lacunas",
        "Distribuição orçamentária otimizada (100% do budget)"
      ]
    },
    {
      date: "02/09/2025",
      title: "Edge Function GPT-Assistant Corrigida",
      description: "Percentuais de orçamento ajustados e palavras-chave para Guarnição",
      type: "bug-fix",
      impact: "alto",
      details: [
        "Percentuais corrigidos: PP1 (22%), PP2 (18%), Guarnição (10%)",
        "Soma exata de 100% do orçamento diário",
        "Palavras-chave específicas para busca de guarnições",
        "Busca inteligente por batata, farofa, purê, polenta, etc."
      ]
    },
    {
      date: "02/09/2025",
      title: "Hook de Geração Otimizado",
      description: "Mapeamento corrigido elimina duplicatas no frontend",
      type: "bug-fix",
      impact: "alto",
      details: [
        "Mapeamento único por categoria usando Map()",
        "Prevenção de duplicação no processamento",
        "Integração perfeita com WeeklyMenuView",
        "Performance melhorada na renderização"
      ]
    },
    {
      date: "02/09/2025",
      title: "Interface de Geração Atualizada",
      description: "Descrição completa das 10 categorias no gerador",
      type: "feature",
      impact: "médio",
      details: [
        "Texto atualizado incluindo Guarnição e Sobremesa",
        "Descrição precisa da estrutura de cardápios",
        "Interface sincronizada com funcionalidade backend",
        "Melhor experiência do usuário"
      ]
    }
  ];

  const completeHistory = {
    backend: [
      {
        date: "13/10/2025",
        title: "Quick-Worker: Refatoração de Busca de Sucos",
        description: "Simplificação da lógica com queries diretas por categoria",
        status: "concluído"
      },
      {
        date: "17/09/2025",
        title: "Edge Function Generate-Shopping-List Corrigida",
        description: "Normalização de IDs e correção de listas vazias",
        status: "concluído"
      },
      {
        date: "07/09/2025",
        title: "Tabela de Proteínas Categorizadas",
        description: "Migração de 371 receitas para estrutura categorizada",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Sistema de Orçamento Dinâmico",
        description: "Orçamento específico por filial implementado",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Edge Function GPT-Assistant v4.0",
        description: "Correção de escopo e cálculos aprimorados",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Distribuição Orçamentária Otimizada",
        description: "Percentuais ajustados para 10 categorias",
        status: "concluído"
      },
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
        date: "13/10/2025",
        title: "Hook de Geração: Logging Aprimorado",
        description: "Logs detalhados de configuração de sucos para debugging",
        status: "concluído"
      },
      {
        date: "17/09/2025",
        title: "Interface de Listas de Compras Aprimorada",
        description: "Botão 'Corrigir Itens' e indicadores de disponibilidade",
        status: "concluído"
      },
      {
        date: "07/09/2025",
        title: "Hook de Configuração de Proteínas",
        description: "useProteinConfiguration implementado com filtros avançados",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "WeeklyMenuView Completo",
        description: "Renderização de 10 categorias fixas sem duplicação",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Interface de Geração Atualizada",
        description: "Descrição completa das categorias disponíveis",
        status: "concluído"
      },
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
        date: "13/10/2025",
        title: "Busca Inteligente de Sucos Otimizada",
        description: "Switch direto por tipo eliminando complexidade de regex e filtros",
        status: "concluído"
      },
      {
        date: "07/09/2025",
        title: "Eliminação de Classificação por Regex",
        description: "Substituição da lógica regex por busca direta em tabela categorizada",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "IA com Orçamento Personalizado",
        description: "Inteligência artificial adaptada ao orçamento específico de cada filial",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Sistema de Busca Inteligente",
        description: "Palavras-chave específicas para cada categoria",
        status: "concluído"
      },
      {
        date: "02/09/2025",
        title: "Prevenção de Duplicação",
        description: "IA evita repetição de categorias nos cardápios",
        status: "concluído"
      },
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
        date: "07/09/2025",
        title: "Compatibilidade Sistema Legacy",
        description: "Manutenção da integração com classificação categorizadas",
        status: "concluído"
      },
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
      title: "Fase 1 - Sistema de Proteínas",
      description: "Estrutura categorizada para classificação automática",
      status: "concluído",
      priority: "crítica",
      quarter: "Q3 2025"
    },
    {
      title: "Fase 2 - Guarnições e Saladas",
      description: "Categorização de acompanhamentos e saladas por tabela",
      status: "em-desenvolvimento",
      priority: "alta",
      quarter: "Q3 2025"
    },
    {
      title: "Fase 3 - Sobremesas e Bebidas",
      description: "Finalização da migração para sistema categorizado",
      status: "planejado",
      priority: "alta",
      quarter: "Q4 2025"
    },
    {
      title: "Sistema de Notificações",
      description: "Alertas em tempo real para aprovações e alterações",
      status: "planejado",
      priority: "média",
      quarter: "Q4 2025"
    },
    {
      title: "Relatórios Avançados",
      description: "Analytics detalhados e exportação personalizada",
      status: "planejado",
      priority: "média",
      quarter: "Q1 2026"
    },
    {
      title: "App Mobile",
      description: "Versão mobile para gestores e nutricionistas",
      status: "planejado",
      priority: "alta",
      quarter: "Q2 2026"
    },
    {
      title: "IA Preditiva",
      description: "Previsão de demanda e otimização automática",
      status: "pesquisa",
      priority: "baixa",
      quarter: "Q3 2026"
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoramento
          </TabsTrigger>
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

        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid gap-6">
            <MenuGenerationTestRunner />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Status do Sistema
                </CardTitle>
                <CardDescription>
                  Monitoramento em tempo real da conectividade e saúde do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConnectivityTest />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Diagnóstico Rápido</CardTitle>
                <CardDescription>
                  Problemas identificados e correções implementadas hoje
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Routing Corrigido</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Ativo
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Connectivity Test</span>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    Implementado
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">Edge Functions Health</span>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Monitorando
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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