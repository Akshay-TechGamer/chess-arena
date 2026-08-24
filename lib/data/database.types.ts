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
      app_settings: {
        Row: {
          k: string
          v: string
        }
        Insert: {
          k: string
          v: string
        }
        Update: {
          k?: string
          v?: string
        }
        Relationships: []
      }
      chess_games: {
        Row: {
          black_id: string | null
          created_at: string
          fen: string
          id: string
          increment_secs: number
          invite_code: string | null
          mode: Database["public"]["Enums"]["chess_game_mode"]
          pgn: string
          result: Database["public"]["Enums"]["chess_game_result"] | null
          result_reason: string | null
          status: Database["public"]["Enums"]["chess_game_status"]
          time_control_secs: number
          updated_at: string
          white_id: string | null
        }
        Insert: {
          black_id?: string | null
          created_at?: string
          fen?: string
          id?: string
          increment_secs?: number
          invite_code?: string | null
          mode?: Database["public"]["Enums"]["chess_game_mode"]
          pgn?: string
          result?: Database["public"]["Enums"]["chess_game_result"] | null
          result_reason?: string | null
          status?: Database["public"]["Enums"]["chess_game_status"]
          time_control_secs?: number
          updated_at?: string
          white_id?: string | null
        }
        Update: {
          black_id?: string | null
          created_at?: string
          fen?: string
          id?: string
          increment_secs?: number
          invite_code?: string | null
          mode?: Database["public"]["Enums"]["chess_game_mode"]
          pgn?: string
          result?: Database["public"]["Enums"]["chess_game_result"] | null
          result_reason?: string | null
          status?: Database["public"]["Enums"]["chess_game_status"]
          time_control_secs?: number
          updated_at?: string
          white_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chess_games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "chess_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chess_games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "chess_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chess_matchmaking_queue: {
        Row: {
          enqueued_at: string
          user_id: string
        }
        Insert: {
          enqueued_at?: string
          user_id: string
        }
        Update: {
          enqueued_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chess_matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "chess_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chess_moves: {
        Row: {
          black_ms_left: number
          created_at: string
          fen_after: string
          game_id: string
          id: number
          ply: number
          san: string
          white_ms_left: number
        }
        Insert: {
          black_ms_left: number
          created_at?: string
          fen_after: string
          game_id: string
          id?: never
          ply: number
          san: string
          white_ms_left: number
        }
        Update: {
          black_ms_left?: number
          created_at?: string
          fen_after?: string
          game_id?: string
          id?: never
          ply?: number
          san?: string
          white_ms_left?: number
        }
        Relationships: [
          {
            foreignKeyName: "chess_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "chess_games"
            referencedColumns: ["id"]
          },
        ]
      }
      chess_profiles: {
        Row: {
          created_at: string
          elo_rating: number
          games_played: number
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          elo_rating?: number
          games_played?: number
          id: string
          username: string
        }
        Update: {
          created_at?: string
          elo_rating?: number
          games_played?: number
          id?: string
          username?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          name: string
          ref: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          name: string
          ref: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          name?: string
          ref?: string
          status?: string
        }
        Relationships: []
      }
      game_history: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          moves: Json
          players: Json
          room_id: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          moves: Json
          players: Json
          room_id?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          moves?: Json
          players?: Json
          room_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_room_players: {
        Row: {
          avatar_emoji: string | null
          guest_id: string | null
          id: string
          is_host: boolean | null
          is_ready: boolean | null
          joined_at: string | null
          player_color: string | null
          player_name: string
          player_number: number | null
          room_id: string
          user_id: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          guest_id?: string | null
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          player_color?: string | null
          player_name: string
          player_number?: number | null
          room_id: string
          user_id?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          guest_id?: string | null
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          player_color?: string | null
          player_name?: string
          player_number?: number | null
          room_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          code: string
          created_at: string | null
          finished_at: string | null
          game_state: Json | null
          host_id: string | null
          id: string
          max_players: number | null
          name: string | null
          settings: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          finished_at?: string | null
          game_state?: Json | null
          host_id?: string | null
          id?: string
          max_players?: number | null
          name?: string | null
          settings?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          finished_at?: string | null
          game_state?: Json | null
          host_id?: string | null
          id?: string
          max_players?: number | null
          name?: string | null
          settings?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          category: string
          created_at: string | null
          id: string
          user_id: string
          username: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          user_id: string
          username: string
          value: number
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          user_id?: string
          username?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          preferred_color: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          preferred_color?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          preferred_color?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      user_statistics: {
        Row: {
          best_win_streak: number | null
          current_win_streak: number | null
          fastest_win_ms: number | null
          games_lost: number | null
          games_played: number | null
          games_won: number | null
          id: string
          total_pawns_captured: number | null
          total_pawns_finished: number | null
          total_pawns_lost: number | null
          total_play_time_ms: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_win_streak?: number | null
          current_win_streak?: number | null
          fastest_win_ms?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          total_pawns_captured?: number | null
          total_pawns_finished?: number | null
          total_pawns_lost?: number | null
          total_play_time_ms?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_win_streak?: number | null
          current_win_streak?: number | null
          fastest_win_ms?: number | null
          games_lost?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string
          total_pawns_captured?: number | null
          total_pawns_finished?: number | null
          total_pawns_lost?: number | null
          total_play_time_ms?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wishes: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          payload: Json
          photo: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          id: string
          payload: Json
          photo?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          payload?: Json
          photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_decide: {
        Args: { p_action: string; p_id: string; p_key: string }
        Returns: string
      }
      admin_list: { Args: { p_key: string }; Returns: Json }
      chess_quick_match: { Args: never; Returns: string }
      chess_quick_match_cancel: { Args: never; Returns: undefined }
      claim_status: { Args: { claim_id: string }; Returns: string }
      create_claim: { Args: { p_name: string; p_ref: string }; Returns: string }
      create_wish: {
        Args: { p_claim: string; p_payload: Json; p_photo: string }
        Returns: string
      }
      get_user_rank: {
        Args: { p_category: string; p_user_id: string }
        Returns: number
      }
      get_wish: { Args: { p_id: string }; Returns: Json }
    }
    Enums: {
      chess_game_mode: "online" | "computer"
      chess_game_result: "white_win" | "black_win" | "draw"
      chess_game_status: "waiting" | "active" | "finished" | "aborted"
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
      chess_game_mode: ["online", "computer"],
      chess_game_result: ["white_win", "black_win", "draw"],
      chess_game_status: ["waiting", "active", "finished", "aborted"],
    },
  },
} as const
