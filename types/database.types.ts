export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Triage assessment for content quality
export interface TriageData {
  quality_score: number // 1-10
  worth_your_time: string // "Yes/No/Maybe - reason"
  target_audience: string[] // ["Developers", "Founders", etc.]
  content_density: string // "Low/Medium/High - description"
  estimated_value?: string // What you'll gain
  signal_noise_score: number // 0=Noise, 1=Noteworthy, 2=Insightful, 3=Mind-blowing
}

// Truth check analysis
export interface TruthCheckData {
  overall_rating: "Accurate" | "Mostly Accurate" | "Mixed" | "Questionable" | "Unreliable"
  issues: Array<{
    type: "misinformation" | "misleading" | "bias" | "unjustified_certainty" | "missing_context"
    claim_or_issue: string
    assessment: string
    severity: "low" | "medium" | "high"
    timestamp?: string // e.g., "2:34" for YouTube videos
  }>
  strengths: string[]
  sources_quality: string
}

// Action items extracted from content
export interface ActionItemData {
  title: string // Short actionable title
  description: string // How to implement this
  priority: "high" | "medium" | "low" // Implementation priority
  category?: string // e.g., "Strategy", "Technical", "Mindset"
}

export type ActionItemsData = ActionItemData[]

// Processing status for summaries
export type ProcessingStatus =
  | "pending"
  | "overview_complete"
  | "triage_complete"
  | "truth_check_complete"
  | "action_items_complete"
  | "short_summary_complete"
  | "complete"
  | "error"

export interface Database {
  public: {
    Tables: {
      active_chat_prompt: {
        Row: {
          id: number
          system_content: string | null
          created_at: string
          updated_at: string | null
          temperature: number | null
          top_p: number | null
          max_tokens: number | null
          model_name: string | null
        }
        Insert: {
          id?: number
          system_content?: string | null
          created_at?: string
          updated_at?: string | null
          temperature?: number | null
          top_p?: number | null
          max_tokens?: number | null
          model_name?: string | null
        }
        Update: {
          id?: number
          system_content?: string | null
          created_at?: string
          updated_at?: string | null
          temperature?: number | null
          top_p?: number | null
          max_tokens?: number | null
          model_name?: string | null
        }
        Relationships: []
      }
      active_summarizer_prompt: {
        Row: {
          id: number
          system_content: string
          user_content_template: string
          created_at: string | null
          updated_at: string | null
          temperature: number | null
          top_p: number | null
          max_tokens: number | null
          model_name: string | null
        }
        Insert: {
          id?: number
          system_content: string
          user_content_template: string
          created_at?: string | null
          updated_at?: string | null
          temperature?: number | null
          top_p?: number | null
          max_tokens?: number | null
          model_name?: string | null
        }
        Update: {
          id?: number
          system_content?: string
          user_content_template?: string
          created_at?: string | null
          updated_at?: string | null
          temperature?: number | null
          top_p?: number | null
          max_tokens?: number | null
          model_name?: string | null
        }
        Relationships: []
      }
      analysis_prompts: {
        Row: {
          id: string
          prompt_type: string
          name: string
          description: string | null
          system_content: string
          user_content_template: string
          model_name: string
          temperature: number | null
          max_tokens: number | null
          expect_json: boolean | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          prompt_type: string
          name: string
          description?: string | null
          system_content: string
          user_content_template: string
          model_name?: string
          temperature?: number | null
          max_tokens?: number | null
          expect_json?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          prompt_type?: string
          name?: string
          description?: string | null
          system_content?: string
          user_content_template?: string
          model_name?: string
          temperature?: number | null
          max_tokens?: number | null
          expect_json?: boolean | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          text: string | null
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          text?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          author: string | null
          channel_id: string | null
          date_added: string | null
          description: string | null
          duration: number | null
          full_text: string | null
          id: string
          is_bookmarked: boolean | null
          like_count: number | null
          raw_youtube_metadata: Json | null
          thumbnail_url: string | null
          title: string | null
          transcript_languages: string[] | null
          type: string | null
          upload_date: string | null
          url: string
          user_id: string | null
          view_count: number | null
          tags: string[] | null
        }
        Insert: {
          author?: string | null
          channel_id?: string | null
          date_added?: string | null
          description?: string | null
          duration?: number | null
          full_text?: string | null
          id?: string
          is_bookmarked?: boolean | null
          like_count?: number | null
          raw_youtube_metadata?: Json | null
          thumbnail_url?: string | null
          title?: string | null
          transcript_languages?: string[] | null
          type?: string | null
          upload_date?: string | null
          url: string
          user_id?: string | null
          view_count?: number | null
          tags?: string[] | null
        }
        Update: {
          author?: string | null
          channel_id?: string | null
          date_added?: string | null
          description?: string | null
          duration?: number | null
          full_text?: string | null
          id?: string
          is_bookmarked?: boolean | null
          like_count?: number | null
          raw_youtube_metadata?: Json | null
          thumbnail_url?: string | null
          title?: string | null
          transcript_languages?: string[] | null
          type?: string | null
          upload_date?: string | null
          url?: string
          user_id?: string | null
          view_count?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "content_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          domain: string
          total_analyses: number
          total_quality_score: number
          avg_quality_score: number | null
          accurate_count: number
          mostly_accurate_count: number
          mixed_count: number
          questionable_count: number
          unreliable_count: number
          first_seen: string
          last_seen: string
        }
        Insert: {
          domain: string
          total_analyses?: number
          total_quality_score?: number
          accurate_count?: number
          mostly_accurate_count?: number
          mixed_count?: number
          questionable_count?: number
          unreliable_count?: number
          first_seen?: string
          last_seen?: string
        }
        Update: {
          domain?: string
          total_analyses?: number
          total_quality_score?: number
          accurate_count?: number
          mostly_accurate_count?: number
          mixed_count?: number
          questionable_count?: number
          unreliable_count?: number
          first_seen?: string
          last_seen?: string
        }
        Relationships: []
      }
      hidden_content: {
        Row: {
          id: string
          user_id: string
          content_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hidden_content_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_content_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ratings: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          signal_score: number
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          signal_score: number
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          signal_score?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ratings_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ratings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          id: string
          user_id: string
          content_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          id: string
          thread_id: string
          role: "user" | "assistant"
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          role: "user" | "assistant"
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          role?: "user" | "assistant"
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          id: string
          content_id: string
          user_id: string
          model_name: string | null
          created_at: string
          updated_at: string | null
          // Summary sections
          brief_overview: string | null
          triage: Json | null // TriageData
          truth_check: Json | null // TruthCheckData
          action_items: Json | null // ActionItemsData
          mid_length_summary: string | null // Legacy, kept for compatibility
          detailed_summary: string | null
          processing_status: string | null // ProcessingStatus
        }
        Insert: {
          id?: string
          content_id: string
          user_id: string
          model_name?: string | null
          created_at?: string
          updated_at?: string | null
          brief_overview?: string | null
          triage?: Json | null
          truth_check?: Json | null
          action_items?: Json | null
          mid_length_summary?: string | null
          detailed_summary?: string | null
          processing_status?: string | null
        }
        Update: {
          id?: string
          content_id?: string
          user_id?: string
          model_name?: string | null
          created_at?: string
          updated_at?: string | null
          brief_overview?: string | null
          triage?: Json | null
          truth_check?: Json | null
          action_items?: Json | null
          mid_length_summary?: string | null
          detailed_summary?: string | null
          processing_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summaries_content_id_fkey"
            columns: ["content_id"]
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          level: number | null
          name: string | null
          reputation: number | null
          xp: number | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_id: string | null
          subscription_ends_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          level?: number | null
          name?: string | null
          reputation?: number | null
          xp?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_id?: string | null
          subscription_ends_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          level?: number | null
          name?: string | null
          reputation?: number | null
          xp?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_id?: string | null
          subscription_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      upsert_domain_stats: {
        Args: {
          p_domain: string
          p_quality_score: number
          p_accurate?: number
          p_mostly_accurate?: number
          p_mixed?: number
          p_questionable?: number
          p_unreliable?: number
        }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"]

export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Insert"]

export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Update"]
