export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      co_solicitacao_produto_listagem: {
        Row: {
          arredondar_tipo: number | null
          categoria_descricao: string | null
          categoria_id: number | null
          criado_em: string | null
          descricao: string | null
          grupo: string | null
          inteiro: boolean | null
          per_capita: number | null
          preco: number | null
          preco_compra: number | null
          produto_base_id: number | null
          produto_id: number | null
          promocao: boolean | null
          quantidade_embalagem: number | null
          solicitacao_id: number
          unidade: string | null
        }
        Insert: {
          arredondar_tipo?: number | null
          categoria_descricao?: string | null
          categoria_id?: number | null
          criado_em?: string | null
          descricao?: string | null
          grupo?: string | null
          inteiro?: boolean | null
          per_capita?: number | null
          preco?: number | null
          preco_compra?: number | null
          produto_base_id?: number | null
          produto_id?: number | null
          promocao?: boolean | null
          quantidade_embalagem?: number | null
          solicitacao_id: number
          unidade?: string | null
        }
        Update: {
          arredondar_tipo?: number | null
          categoria_descricao?: string | null
          categoria_id?: number | null
          criado_em?: string | null
          descricao?: string | null
          grupo?: string | null
          inteiro?: boolean | null
          per_capita?: number | null
          preco?: number | null
          preco_compra?: number | null
          produto_base_id?: number | null
          produto_id?: number | null
          promocao?: boolean | null
          quantidade_embalagem?: number | null
          solicitacao_id?: number
          unidade?: string | null
        }
        Relationships: []
      }
      contratos_corporativos: {
        Row: {
          ativo: boolean
          cliente_id_legado: string
          created_at: string
          custo_maximo_refeicao: number
          id: string
          nome_empresa: string
          periodicidade: string
          restricoes_alimentares: string[] | null
          sync_at: string
          total_funcionarios: number
          total_refeicoes_mes: number
        }
        Insert: {
          ativo?: boolean
          cliente_id_legado: string
          created_at?: string
          custo_maximo_refeicao?: number
          id?: string
          nome_empresa: string
          periodicidade?: string
          restricoes_alimentares?: string[] | null
          sync_at?: string
          total_funcionarios?: number
          total_refeicoes_mes?: number
        }
        Update: {
          ativo?: boolean
          cliente_id_legado?: string
          created_at?: string
          custo_maximo_refeicao?: number
          id?: string
          nome_empresa?: string
          periodicidade?: string
          restricoes_alimentares?: string[] | null
          sync_at?: string
          total_funcionarios?: number
          total_refeicoes_mes?: number
        }
        Relationships: []
      }
      produtos_legado: {
        Row: {
          categoria: string | null
          created_at: string
          disponivel: boolean
          id: string
          nome: string
          peso_unitario: number
          preco_unitario: number
          produto_id_legado: string
          sync_at: string
          unidade: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          disponivel?: boolean
          id?: string
          nome: string
          peso_unitario?: number
          preco_unitario?: number
          produto_id_legado: string
          sync_at?: string
          unidade: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          disponivel?: boolean
          id?: string
          nome?: string
          peso_unitario?: number
          preco_unitario?: number
          produto_id_legado?: string
          sync_at?: string
          unidade?: string
        }
        Relationships: []
      }
      receitas_legado: {
        Row: {
          categoria_receita: string | null
          created_at: string
          custo_total: number | null
          id: string
          ingredientes: Json
          modo_preparo: string | null
          nome_receita: string
          porcoes: number | null
          receita_id_legado: string
          sync_at: string
          tempo_preparo: number | null
        }
        Insert: {
          categoria_receita?: string | null
          created_at?: string
          custo_total?: number | null
          id?: string
          ingredientes?: Json
          modo_preparo?: string | null
          nome_receita: string
          porcoes?: number | null
          receita_id_legado: string
          sync_at?: string
          tempo_preparo?: number | null
        }
        Update: {
          categoria_receita?: string | null
          created_at?: string
          custo_total?: number | null
          id?: string
          ingredientes?: Json
          modo_preparo?: string | null
          nome_receita?: string
          porcoes?: number | null
          receita_id_legado?: string
          sync_at?: string
          tempo_preparo?: number | null
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          id: string
          product_id_legado: string
          product_name: string
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
          product_id_legado: string
          product_name: string
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
          product_id_legado?: string
          product_name?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
