
import { Node, Edge, MarkerType } from '@xyflow/react';

export const initialNodes: Node[] = [
  // User Interface Layer
  {
    id: 'dashboard',
    type: 'custom',
    position: { x: 50, y: 50 },
    data: { 
      label: 'Dashboard',
      description: 'Painel principal com métricas',
      category: 'interface'
    },
  },
  {
    id: 'cardapios',
    type: 'custom',
    position: { x: 250, y: 50 },
    data: { 
      label: 'Cardápios',
      description: 'Geração de cardápios com IA',
      category: 'interface'
    },
  },
  {
    id: 'compras',
    type: 'custom',
    position: { x: 450, y: 50 },
    data: { 
      label: 'Compras',
      description: 'Sistema de compras e fornecedores',
      category: 'interface'
    },
  },
  {
    id: 'relatorios',
    type: 'custom',
    position: { x: 650, y: 50 },
    data: { 
      label: 'Relatórios',
      description: 'Análises e relatórios',
      category: 'interface'
    },
  },

  // AI Assistant Layer
  {
    id: 'gpt-assistant',
    type: 'ai',
    position: { x: 350, y: 200 },
    data: { 
      label: 'GPT Assistant',
      description: 'OpenAI GPT-4 para geração de cardápios',
      model: 'gpt-4o-mini'
    },
  },
  {
    id: 'nlp-processor',
    type: 'ai',
    position: { x: 150, y: 200 },
    data: { 
      label: 'NLP Processor',
      description: 'Processamento de linguagem natural',
      model: 'text-processing'
    },
  },

  // Business Logic Layer
  {
    id: 'menu-generator',
    type: 'custom',
    position: { x: 50, y: 350 },
    data: { 
      label: 'Menu Generator',
      description: 'Lógica de geração de cardápios',
      category: 'business'
    },
  },
  {
    id: 'cost-calculator',
    type: 'custom',
    position: { x: 250, y: 350 },
    data: { 
      label: 'Cost Calculator',
      description: 'Cálculo de custos nutricionais',
      category: 'business'
    },
  },
  {
    id: 'nutrition-analyzer',
    type: 'custom',
    position: { x: 450, y: 350 },
    data: { 
      label: 'Nutrition Analyzer',
      description: 'Análise nutricional automática',
      category: 'business'
    },
  },
  {
    id: 'sync-manager',
    type: 'custom',
    position: { x: 650, y: 350 },
    data: { 
      label: 'Sync Manager',
      description: 'Gerenciador de sincronização',
      category: 'business'
    },
  },

  // Data Layer
  {
    id: 'supabase',
    type: 'database',
    position: { x: 150, y: 500 },
    data: { 
      label: 'Supabase',
      description: 'Banco principal (PostgreSQL)',
      tables: ['contratos_corporativos', 'produtos_legado', 'receitas_legado', 'sync_logs']
    },
  },
  {
    id: 'legacy-db',
    type: 'database',
    position: { x: 450, y: 500 },
    data: { 
      label: 'Sistema Legado',
      description: 'SQL Server existente',
      tables: ['produtos', 'receitas', 'clientes_corporativos']
    },
  },

  // External Services
  {
    id: 'openai-api',
    type: 'ai',
    position: { x: 50, y: 650 },
    data: { 
      label: 'OpenAI API',
      description: 'Serviço de IA externa',
      model: 'gpt-4o-mini'
    },
  },

  // Users
  {
    id: 'nutricionista',
    type: 'user',
    position: { x: 300, y: 650 },
    data: { 
      label: 'Nutricionista',
      description: 'Usuário especialista',
      role: 'expert'
    },
  },
  {
    id: 'empresa',
    type: 'user',
    position: { x: 500, y: 650 },
    data: { 
      label: 'Empresa Cliente',
      description: 'Cliente corporativo',
      role: 'client'
    },
  },
];

export const initialEdges: Edge[] = [
  // Interface to AI connections
  {
    id: 'e1',
    source: 'cardapios',
    target: 'gpt-assistant',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Gerar Cardápio',
  },
  {
    id: 'e2',
    source: 'cardapios',
    target: 'nlp-processor',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Comando NLP',
  },

  // AI to Business Logic
  {
    id: 'e3',
    source: 'gpt-assistant',
    target: 'menu-generator',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e4',
    source: 'nlp-processor',
    target: 'menu-generator',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },

  // Business Logic connections
  {
    id: 'e5',
    source: 'menu-generator',
    target: 'cost-calculator',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e6',
    source: 'cost-calculator',
    target: 'nutrition-analyzer',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e7',
    source: 'compras',
    target: 'sync-manager',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Sincronização',
  },

  // Data connections
  {
    id: 'e8',
    source: 'menu-generator',
    target: 'supabase',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e9',
    source: 'cost-calculator',
    target: 'supabase',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e10',
    source: 'sync-manager',
    target: 'legacy-db',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Leitura',
  },
  {
    id: 'e11',
    source: 'sync-manager',
    target: 'supabase',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Gravação',
  },

  // External services
  {
    id: 'e12',
    source: 'gpt-assistant',
    target: 'openai-api',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'API Call',
  },

  // User interactions
  {
    id: 'e13',
    source: 'nutricionista',
    target: 'dashboard',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e14',
    source: 'nutricionista',
    target: 'cardapios',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e15',
    source: 'empresa',
    target: 'relatorios',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },

  // Dashboard connections
  {
    id: 'e16',
    source: 'dashboard',
    target: 'supabase',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Métricas',
  },
  {
    id: 'e17',
    source: 'relatorios',
    target: 'supabase',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: 'Dados',
  },
];
