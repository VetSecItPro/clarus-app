export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
        }
        Insert: {
          author?: string | null
          channel_id?: string | null
          date_added?: string | null
          description?: string | null
          duration?: number | null
          full_text?: string | null
          id?: string
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
        }
        Update: {
          author?: string | null
          channel_id?: string | null
          date_added?: string | null
          description?: string | null
          duration?: number | null
          full_text?: string | null
          id?: string
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
          content_id: string | null
          created_at: string | null
          id: string
          mid_length_summary: string | null
          model_name: string | null
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          mid_length_summary?: string | null
          model_name?: string | null
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          mid_length_summary?: string | null
          model_name?: string | null
          user_id?: string | null
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
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<
  Public extends boolean = true,
  TableName extends string & keyof Database["public"]["Tables"] = string,
> = Public extends true
  ? Database["public"]["Tables"][TableName]["Row"]
  : Database["public"]["Tables"][TableName]["Insert"]
