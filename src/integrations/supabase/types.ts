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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          cep: string | null
          created_at: string
          document: string
          email: string | null
          id: string
          is_armed: boolean | null
          name: string
          notes: string | null
          phone: string
          pix_key: string | null
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cep?: string | null
          created_at?: string
          document: string
          email?: string | null
          id?: string
          is_armed?: boolean | null
          name: string
          notes?: string | null
          phone: string
          pix_key?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cep?: string | null
          created_at?: string
          document?: string
          email?: string | null
          id?: string
          is_armed?: boolean | null
          name?: string
          notes?: string | null
          phone?: string
          pix_key?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          cep: string | null
          city: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_coordinates_lat: number | null
          default_coordinates_lng: number | null
          document: string
          id: string
          name: string
          notes: string | null
          state: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_coordinates_lat?: number | null
          default_coordinates_lng?: number | null
          document: string
          id?: string
          name: string
          notes?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_coordinates_lat?: number | null
          default_coordinates_lng?: number | null
          document?: string
          id?: string
          name?: string
          notes?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_url: string
          id: string
          ticket_id: string
          uploaded_by_user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_url: string
          id?: string
          ticket_id: string
          uploaded_by_user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_url?: string
          id?: string
          ticket_id?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          city: string
          client_id: string
          code: string
          coordinates_lat: number | null
          coordinates_lng: number | null
          created_at: string
          created_by_user_id: string
          detailed_report: string | null
          duration_minutes: number | null
          end_datetime: string | null
          food_cost: number | null
          id: string
          km_end: number | null
          km_start: number | null
          main_agent_id: string
          other_costs: number | null
          plan_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_datetime: string
          state: string
          status: Database["public"]["Enums"]["ticket_status"]
          summary: string | null
          support_agent_1_arrival: string | null
          support_agent_1_departure: string | null
          support_agent_1_id: string | null
          support_agent_2_arrival: string | null
          support_agent_2_departure: string | null
          support_agent_2_id: string | null
          toll_cost: number | null
          total_cost: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          city: string
          client_id: string
          code: string
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          created_at?: string
          created_by_user_id: string
          detailed_report?: string | null
          duration_minutes?: number | null
          end_datetime?: string | null
          food_cost?: number | null
          id?: string
          km_end?: number | null
          km_start?: number | null
          main_agent_id: string
          other_costs?: number | null
          plan_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_datetime: string
          state: string
          status?: Database["public"]["Enums"]["ticket_status"]
          summary?: string | null
          support_agent_1_arrival?: string | null
          support_agent_1_departure?: string | null
          support_agent_1_id?: string | null
          support_agent_2_arrival?: string | null
          support_agent_2_departure?: string | null
          support_agent_2_id?: string | null
          toll_cost?: number | null
          total_cost?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          city?: string
          client_id?: string
          code?: string
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          created_at?: string
          created_by_user_id?: string
          detailed_report?: string | null
          duration_minutes?: number | null
          end_datetime?: string | null
          food_cost?: number | null
          id?: string
          km_end?: number | null
          km_start?: number | null
          main_agent_id?: string
          other_costs?: number | null
          plan_id?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          start_datetime?: string
          state?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          summary?: string | null
          support_agent_1_arrival?: string | null
          support_agent_1_departure?: string | null
          support_agent_1_id?: string | null
          support_agent_2_arrival?: string | null
          support_agent_2_departure?: string | null
          support_agent_2_id?: string | null
          toll_cost?: number | null
          total_cost?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_main_agent_id_fkey"
            columns: ["main_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_support_agent_1_id_fkey"
            columns: ["support_agent_1_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_support_agent_2_id_fkey"
            columns: ["support_agent_2_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      vehicles: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          description: string
          id: string
          plate_main: string
          plate_trailer: string | null
          tractor_brand: string | null
          tractor_model: string | null
          tractor_plate: string | null
          trailer1_body_type:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer1_plate: string | null
          trailer2_body_type:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer2_plate: string | null
          trailer3_body_type:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer3_plate: string | null
          type: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          description: string
          id?: string
          plate_main: string
          plate_trailer?: string | null
          tractor_brand?: string | null
          tractor_model?: string | null
          tractor_plate?: string | null
          trailer1_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer1_plate?: string | null
          trailer2_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer2_plate?: string | null
          trailer3_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer3_plate?: string | null
          type?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          plate_main?: string
          plate_trailer?: string | null
          tractor_brand?: string | null
          tractor_model?: string | null
          tractor_plate?: string | null
          trailer1_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer1_plate?: string | null
          trailer2_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer2_plate?: string | null
          trailer3_body_type?:
            | Database["public"]["Enums"]["body_type_enum"]
            | null
          trailer3_plate?: string | null
          type?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "ativo" | "inativo"
      app_role: "admin" | "operador" | "agente" | "cliente_visualizacao"
      body_type_enum:
        | "grade_baixa"
        | "grade_alta"
        | "bau"
        | "sider"
        | "frigorifico"
        | "container"
        | "prancha"
      service_type:
        | "alarme"
        | "averiguacao"
        | "preservacao"
        | "acompanhamento_logistico"
      ticket_status: "aberto" | "em_andamento" | "finalizado" | "cancelado"
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
      agent_status: ["ativo", "inativo"],
      app_role: ["admin", "operador", "agente", "cliente_visualizacao"],
      body_type_enum: [
        "grade_baixa",
        "grade_alta",
        "bau",
        "sider",
        "frigorifico",
        "container",
        "prancha",
      ],
      service_type: [
        "alarme",
        "averiguacao",
        "preservacao",
        "acompanhamento_logistico",
      ],
      ticket_status: ["aberto", "em_andamento", "finalizado", "cancelado"],
    },
  },
} as const
