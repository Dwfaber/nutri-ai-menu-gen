export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          id: string
          ip_address: unknown | null
          operation: string
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown | null
          operation: string
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown | null
          operation?: string
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_control: {
        Row: {
          automation_name: string
          created_at: string
          id: string
          is_enabled: boolean
          last_triggered_at: string | null
          next_scheduled_at: string | null
          status: string | null
          trigger_source: string | null
          updated_at: string
        }
        Insert: {
          automation_name: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          next_scheduled_at?: string | null
          status?: string | null
          trigger_source?: string | null
          updated_at?: string
        }
        Update: {
          automation_name?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_triggered_at?: string | null
          next_scheduled_at?: string | null
          status?: string | null
          trigger_source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      co_solicitacao_produto_listagem: {
        Row: {
          apenas_valor_inteiro_sim_nao: boolean | null
          arredondar_tipo: number | null
          categoria_descricao: string | null
          criado_em: string | null
          descricao: string | null
          em_promocao_sim_nao: boolean | null
          grupo: string | null
          per_capita: number | null
          preco: number | null
          produto_base_id: number | null
          produto_base_quantidade_embalagem: number | null
          produto_id: number | null
          solicitacao_id: number | null
          solicitacao_produto_categoria_id: number | null
          solicitacao_produto_listagem_id: number
          sync_at: string
          unidade: string | null
        }
        Insert: {
          apenas_valor_inteiro_sim_nao?: boolean | null
          arredondar_tipo?: number | null
          categoria_descricao?: string | null
          criado_em?: string | null
          descricao?: string | null
          em_promocao_sim_nao?: boolean | null
          grupo?: string | null
          per_capita?: number | null
          preco?: number | null
          produto_base_id?: number | null
          produto_base_quantidade_embalagem?: number | null
          produto_id?: number | null
          solicitacao_id?: number | null
          solicitacao_produto_categoria_id?: number | null
          solicitacao_produto_listagem_id?: number
          sync_at?: string
          unidade?: string | null
        }
        Update: {
          apenas_valor_inteiro_sim_nao?: boolean | null
          arredondar_tipo?: number | null
          categoria_descricao?: string | null
          criado_em?: string | null
          descricao?: string | null
          em_promocao_sim_nao?: boolean | null
          grupo?: string | null
          per_capita?: number | null
          preco?: number | null
          produto_base_id?: number | null
          produto_base_quantidade_embalagem?: number | null
          produto_id?: number | null
          solicitacao_id?: number | null
          solicitacao_produto_categoria_id?: number | null
          solicitacao_produto_listagem_id?: number
          sync_at?: string
          unidade?: string | null
        }
        Relationships: []
      }
      contratos_corporativos: {
        Row: {
          cnpj: string | null
          codigo_externo: number | null
          codigo_externo_2: number | null
          codigo_externo_2_empresa_id: number | null
          codigo_externo_empresa_id: number | null
          controle_interno_custo: boolean | null
          custo_separado: boolean | null
          data_contrato: string | null
          empresa_id_legado: number
          endereco: string | null
          endereco_complemento: string | null
          endereco_numero: string | null
          estoque_central: boolean | null
          filial_id_legado: number
          inscricao_estadual: string | null
          nome_fantasia: string | null
          protein_grams_pp1: number | null
          protein_grams_pp2: number | null
          ratear_custo: boolean | null
          razao_social: string | null
          tipo_custo: number | null
          use_guarnicao_batatas: boolean | null
          use_guarnicao_cereais: boolean | null
          use_guarnicao_legumes: boolean | null
          use_guarnicao_massas: boolean | null
          use_guarnicao_raizes: boolean | null
          use_pro_mix: boolean | null
          use_pro_vita: boolean | null
          use_salada_legumes_cozidos: boolean | null
          use_salada_molhos: boolean | null
          use_salada_verduras: boolean | null
          use_suco_diet: boolean | null
          use_suco_natural: boolean | null
        }
        Insert: {
          cnpj?: string | null
          codigo_externo?: number | null
          codigo_externo_2?: number | null
          codigo_externo_2_empresa_id?: number | null
          codigo_externo_empresa_id?: number | null
          controle_interno_custo?: boolean | null
          custo_separado?: boolean | null
          data_contrato?: string | null
          empresa_id_legado: number
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          estoque_central?: boolean | null
          filial_id_legado: number
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          protein_grams_pp1?: number | null
          protein_grams_pp2?: number | null
          ratear_custo?: boolean | null
          razao_social?: string | null
          tipo_custo?: number | null
          use_guarnicao_batatas?: boolean | null
          use_guarnicao_cereais?: boolean | null
          use_guarnicao_legumes?: boolean | null
          use_guarnicao_massas?: boolean | null
          use_guarnicao_raizes?: boolean | null
          use_pro_mix?: boolean | null
          use_pro_vita?: boolean | null
          use_salada_legumes_cozidos?: boolean | null
          use_salada_molhos?: boolean | null
          use_salada_verduras?: boolean | null
          use_suco_diet?: boolean | null
          use_suco_natural?: boolean | null
        }
        Update: {
          cnpj?: string | null
          codigo_externo?: number | null
          codigo_externo_2?: number | null
          codigo_externo_2_empresa_id?: number | null
          codigo_externo_empresa_id?: number | null
          controle_interno_custo?: boolean | null
          custo_separado?: boolean | null
          data_contrato?: string | null
          empresa_id_legado?: number
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          estoque_central?: boolean | null
          filial_id_legado?: number
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          protein_grams_pp1?: number | null
          protein_grams_pp2?: number | null
          ratear_custo?: boolean | null
          razao_social?: string | null
          tipo_custo?: number | null
          use_guarnicao_batatas?: boolean | null
          use_guarnicao_cereais?: boolean | null
          use_guarnicao_legumes?: boolean | null
          use_guarnicao_massas?: boolean | null
          use_guarnicao_raizes?: boolean | null
          use_pro_mix?: boolean | null
          use_pro_vita?: boolean | null
          use_salada_legumes_cozidos?: boolean | null
          use_salada_molhos?: boolean | null
          use_salada_verduras?: boolean | null
          use_suco_diet?: boolean | null
          use_suco_natural?: boolean | null
        }
        Relationships: []
      }
      custos_filiais: {
        Row: {
          cliente_id_legado: number | null
          created_at: string
          custo_medio_semanal: number | null
          custo_total: number | null
          filial_id: number | null
          id: string
          nome_fantasia: string | null
          nome_filial: string | null
          PorcentagemLimiteAcimaMedia: number | null
          QtdeRefeicoesUsarMediaValidarSimNao: boolean | null
          razao_social: string | null
          RefCustoDiaEspecial: number | null
          RefCustoDomingo: number | null
          RefCustoQuarta: number | null
          RefCustoQuinta: number | null
          RefCustoSabado: number | null
          RefCustoSegunda: number | null
          RefCustoSexta: number | null
          RefCustoTerca: number | null
          solicitacao_compra_tipo_descricao: string | null
          solicitacao_compra_tipo_id: number | null
          solicitacao_filial_custo_id: number | null
          sync_at: string
          updated_at: string
          user_date_time: string | null
          user_name: string | null
        }
        Insert: {
          cliente_id_legado?: number | null
          created_at?: string
          custo_medio_semanal?: number | null
          custo_total?: number | null
          filial_id?: number | null
          id?: string
          nome_fantasia?: string | null
          nome_filial?: string | null
          PorcentagemLimiteAcimaMedia?: number | null
          QtdeRefeicoesUsarMediaValidarSimNao?: boolean | null
          razao_social?: string | null
          RefCustoDiaEspecial?: number | null
          RefCustoDomingo?: number | null
          RefCustoQuarta?: number | null
          RefCustoQuinta?: number | null
          RefCustoSabado?: number | null
          RefCustoSegunda?: number | null
          RefCustoSexta?: number | null
          RefCustoTerca?: number | null
          solicitacao_compra_tipo_descricao?: string | null
          solicitacao_compra_tipo_id?: number | null
          solicitacao_filial_custo_id?: number | null
          sync_at?: string
          updated_at?: string
          user_date_time?: string | null
          user_name?: string | null
        }
        Update: {
          cliente_id_legado?: number | null
          created_at?: string
          custo_medio_semanal?: number | null
          custo_total?: number | null
          filial_id?: number | null
          id?: string
          nome_fantasia?: string | null
          nome_filial?: string | null
          PorcentagemLimiteAcimaMedia?: number | null
          QtdeRefeicoesUsarMediaValidarSimNao?: boolean | null
          razao_social?: string | null
          RefCustoDiaEspecial?: number | null
          RefCustoDomingo?: number | null
          RefCustoQuarta?: number | null
          RefCustoQuinta?: number | null
          RefCustoSabado?: number | null
          RefCustoSegunda?: number | null
          RefCustoSexta?: number | null
          RefCustoTerca?: number | null
          solicitacao_compra_tipo_descricao?: string | null
          solicitacao_compra_tipo_id?: number | null
          solicitacao_filial_custo_id?: number | null
          sync_at?: string
          updated_at?: string
          user_date_time?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      generated_menus: {
        Row: {
          approved_by: string | null
          approved_violations: Json | null
          client_id: string
          client_name: string
          cost_per_meal: number
          created_at: string
          id: string
          meals_per_day: number
          menu_data: Json | null
          nutritionist_suggestions: Json | null
          receitas_adaptadas: Json | null
          receitas_ids: string[] | null
          recipes: Json | null
          rejected_reason: string | null
          status: string
          total_cost: number
          total_recipes: number
          updated_at: string
          violation_notes: string | null
          warnings: Json | null
          week_period: string
        }
        Insert: {
          approved_by?: string | null
          approved_violations?: Json | null
          client_id: string
          client_name: string
          cost_per_meal?: number
          created_at?: string
          id?: string
          meals_per_day?: number
          menu_data?: Json | null
          nutritionist_suggestions?: Json | null
          receitas_adaptadas?: Json | null
          receitas_ids?: string[] | null
          recipes?: Json | null
          rejected_reason?: string | null
          status?: string
          total_cost?: number
          total_recipes?: number
          updated_at?: string
          violation_notes?: string | null
          warnings?: Json | null
          week_period: string
        }
        Update: {
          approved_by?: string | null
          approved_violations?: Json | null
          client_id?: string
          client_name?: string
          cost_per_meal?: number
          created_at?: string
          id?: string
          meals_per_day?: number
          menu_data?: Json | null
          nutritionist_suggestions?: Json | null
          receitas_adaptadas?: Json | null
          receitas_ids?: string[] | null
          recipes?: Json | null
          rejected_reason?: string | null
          status?: string
          total_cost?: number
          total_recipes?: number
          updated_at?: string
          violation_notes?: string | null
          warnings?: Json | null
          week_period?: string
        }
        Relationships: []
      }
      guarnicoes_disponiveis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          nome: string
          prioridade: number | null
          produto_base_id: number
          receita_id_legado: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          nome: string
          prioridade?: number | null
          produto_base_id: number
          receita_id_legado: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          nome?: string
          prioridade?: number | null
          produto_base_id?: number
          receita_id_legado?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarnicoes_disponiveis_receita_id_legado_fkey"
            columns: ["receita_id_legado"]
            isOneToOne: false
            referencedRelation: "receitas_legado"
            referencedColumns: ["receita_id_legado"]
          },
        ]
      }
      produtos_base: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          produto_base_id: number
          sync_at: string
          unidade: string | null
          unidade_medida_id: number | null
          user_date_time: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          produto_base_id: number
          sync_at?: string
          unidade?: string | null
          unidade_medida_id?: number | null
          user_date_time?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          produto_base_id?: number
          sync_at?: string
          unidade?: string | null
          unidade_medida_id?: number | null
          user_date_time?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proteinas_disponiveis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          nome: string
          prioridade: number | null
          produto_base_id: number
          receita_id_legado: string
          subcategoria: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          nome: string
          prioridade?: number | null
          produto_base_id: number
          receita_id_legado: string
          subcategoria: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          nome?: string
          prioridade?: number | null
          produto_base_id?: number
          receita_id_legado?: string
          subcategoria?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proteinas_disponiveis_receita_id_legado_fkey"
            columns: ["receita_id_legado"]
            isOneToOne: false
            referencedRelation: "receitas_legado"
            referencedColumns: ["receita_id_legado"]
          },
        ]
      }
      receita_ingredientes: {
        Row: {
          categoria_descricao: string | null
          created_at: string
          id: string
          nome: string | null
          notas: string | null
          produto_base_descricao: string | null
          produto_base_id: number | null
          produto_id: number | null
          quantidade: number
          quantidade_refeicoes: number | null
          receita_id_legado: string
          receita_produto_classificacao_id: number | null
          receita_produto_id: number | null
          sync_at: string
          unidade: string | null
          unidade_medida_id: number | null
          user_date_time: string | null
          user_name: string | null
        }
        Insert: {
          categoria_descricao?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          notas?: string | null
          produto_base_descricao?: string | null
          produto_base_id?: number | null
          produto_id?: number | null
          quantidade?: number
          quantidade_refeicoes?: number | null
          receita_id_legado: string
          receita_produto_classificacao_id?: number | null
          receita_produto_id?: number | null
          sync_at?: string
          unidade?: string | null
          unidade_medida_id?: number | null
          user_date_time?: string | null
          user_name?: string | null
        }
        Update: {
          categoria_descricao?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          notas?: string | null
          produto_base_descricao?: string | null
          produto_base_id?: number | null
          produto_id?: number | null
          quantidade?: number
          quantidade_refeicoes?: number | null
          receita_id_legado?: string
          receita_produto_classificacao_id?: number | null
          receita_produto_id?: number | null
          sync_at?: string
          unidade?: string | null
          unidade_medida_id?: number | null
          user_date_time?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      receitas_legado: {
        Row: {
          categoria_descricao: string | null
          categoria_id: number | null
          categoria_receita: string | null
          created_at: string
          custo_total: number | null
          id: string
          inativa: boolean
          ingredientes: Json
          modo_preparo: string | null
          nome_receita: string
          porcoes: number | null
          quantidade_refeicoes: number | null
          receita_id_legado: string
          sync_at: string
          tempo_preparo: number | null
          usuario: string | null
        }
        Insert: {
          categoria_descricao?: string | null
          categoria_id?: number | null
          categoria_receita?: string | null
          created_at?: string
          custo_total?: number | null
          id?: string
          inativa?: boolean
          ingredientes?: Json
          modo_preparo?: string | null
          nome_receita: string
          porcoes?: number | null
          quantidade_refeicoes?: number | null
          receita_id_legado: string
          sync_at?: string
          tempo_preparo?: number | null
          usuario?: string | null
        }
        Update: {
          categoria_descricao?: string | null
          categoria_id?: number | null
          categoria_receita?: string | null
          created_at?: string
          custo_total?: number | null
          id?: string
          inativa?: boolean
          ingredientes?: Json
          modo_preparo?: string | null
          nome_receita?: string
          porcoes?: number | null
          quantidade_refeicoes?: number | null
          receita_id_legado?: string
          sync_at?: string
          tempo_preparo?: number | null
          usuario?: string | null
        }
        Relationships: []
      }
      saladas_disponiveis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          nome: string
          prioridade: number | null
          produto_base_id: number
          receita_id_legado: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          nome: string
          prioridade?: number | null
          produto_base_id: number
          receita_id_legado: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          nome?: string
          prioridade?: number | null
          produto_base_id?: number
          receita_id_legado?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "saladas_disponiveis_receita_id_legado_fkey"
            columns: ["receita_id_legado"]
            isOneToOne: false
            referencedRelation: "receitas_legado"
            referencedColumns: ["receita_id_legado"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          id: string
          optimized: boolean
          product_id_legado: string
          product_name: string
          promocao: boolean
          quantity: number
          shopping_list_id: string
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          id?: string
          optimized?: boolean
          product_id_legado: string
          product_name: string
          promocao?: boolean
          quantity: number
          shopping_list_id: string
          total_price?: number
          unit: string
          unit_price?: number
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          id?: string
          optimized?: boolean
          product_id_legado?: string
          product_name?: string
          promocao?: boolean
          quantity?: number
          shopping_list_id?: string
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          budget_predicted: number
          client_name: string
          cost_actual: number | null
          created_at: string
          id: string
          menu_id: string
          status: string
          updated_at: string
        }
        Insert: {
          budget_predicted?: number
          client_name: string
          cost_actual?: number | null
          created_at?: string
          id?: string
          menu_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          budget_predicted?: number
          client_name?: string
          cost_actual?: number | null
          created_at?: string
          id?: string
          menu_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sucos_disponiveis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          nome: string
          produto_base_id: number
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          nome: string
          produto_base_id: number
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          nome?: string
          produto_base_id?: number
          tipo?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          detalhes: Json | null
          erro_msg: string | null
          id: string
          operacao: string
          registros_processados: number | null
          status: string
          tabela_destino: string
          tempo_execucao_ms: number | null
          ultima_sync: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          erro_msg?: string | null
          id?: string
          operacao?: string
          registros_processados?: number | null
          status?: string
          tabela_destino: string
          tempo_execucao_ms?: number | null
          ultima_sync?: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          erro_msg?: string | null
          id?: string
          operacao?: string
          registros_processados?: number | null
          status?: string
          tabela_destino?: string
          tempo_execucao_ms?: number | null
          ultima_sync?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_upsert_cleanup: {
        Args: {
          cleanup_days?: number
          data_json: Json
          target_table: string
          unique_columns?: string[]
        }
        Returns: Json
      }
      cleanup_old_product_versions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      gerar_cardapio: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_use_pro_mix?: boolean
          p_use_pro_vita?: boolean
          p_use_suco_diet?: boolean
          p_use_suco_natural?: boolean
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      simple_upsert_cleanup: {
        Args: { cleanup_days?: number; data_json: Json; target_table: string }
        Returns: Json
      }
      upsert_with_cleanup: {
        Args: {
          cleanup_days?: number
          data_json: Json
          target_table: string
          unique_columns: string[]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "nutritionist" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "nutritionist", "viewer"],
    },
  },
} as const
