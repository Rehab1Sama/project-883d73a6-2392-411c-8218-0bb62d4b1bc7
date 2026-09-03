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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          circle_id: string
          created_at: string
          entered_by: string | null
          id: string
          notes: string | null
          record_date: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          record_date?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          record_date?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_students: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_students_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          schedule: Json
          status: string
          teacher_name: string | null
          teacher_user_id: string | null
          tenant_id: string
          track_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          schedule?: Json
          status?: string
          teacher_name?: string | null
          teacher_user_id?: string | null
          tenant_id: string
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          schedule?: Json
          status?: string
          teacher_name?: string | null
          teacher_user_id?: string | null
          tenant_id?: string
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circles_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string
          default_enabled: boolean
          description_ar: string | null
          id: string
          key: string
          name_ar: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_enabled?: boolean
          description_ar?: string | null
          id?: string
          key: string
          name_ar: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_enabled?: boolean
          description_ar?: string | null
          id?: string
          key?: string
          name_ar?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string
          currency: string
          description: string | null
          due_at: string | null
          id: string
          issued_at: string
          notes: string | null
          number: string
          paid_at: string | null
          payment_intent_id: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          provider: string | null
          provider_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          tax_amount: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          provider?: string | null
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          tax_amount?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          provider?: string | null
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          tax_amount?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          metadata: Json
          plan_id: string
          plan_request_id: string | null
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          plan_id: string
          plan_request_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          plan_id?: string
          plan_request_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_plan_request_id_fkey"
            columns: ["plan_request_id"]
            isOneToOne: false
            referencedRelation: "plan_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          invoice_id: string | null
          payload: Json
          payment_intent_id: string | null
          processed_at: string | null
          provider: string
          signature_verified: boolean
          status: Database["public"]["Enums"]["webhook_event_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          invoice_id?: string | null
          payload?: Json
          payment_intent_id?: string | null
          processed_at?: string | null
          provider: string
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["webhook_event_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          payload?: Json
          payment_intent_id?: string | null
          processed_at?: string | null
          provider?: string
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["webhook_event_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          plan_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requests: {
        Row: {
          billing_period: Database["public"]["Enums"]["billing_period"]
          contact_name: string
          created_at: string
          email: string
          id: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          tenant_id: string | null
          tenant_name: string
          updated_at: string
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          contact_name: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id?: string | null
          tenant_name: string
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id?: string | null
          tenant_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          compare_lifetime: number | null
          compare_monthly: number | null
          compare_yearly: number | null
          created_at: string
          currency: string
          description_ar: string | null
          features: Json
          id: string
          is_active: boolean
          is_custom_priced: boolean
          is_featured: boolean
          max_circles: number
          max_students: number
          max_teachers: number
          name_ar: string
          price_lifetime: number
          price_monthly: number
          price_yearly: number
          setup_fee: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          compare_lifetime?: number | null
          compare_monthly?: number | null
          compare_yearly?: number | null
          created_at?: string
          currency?: string
          description_ar?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom_priced?: boolean
          is_featured?: boolean
          max_circles?: number
          max_students?: number
          max_teachers?: number
          name_ar: string
          price_lifetime?: number
          price_monthly?: number
          price_yearly?: number
          setup_fee?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          compare_lifetime?: number | null
          compare_monthly?: number | null
          compare_yearly?: number | null
          created_at?: string
          currency?: string
          description_ar?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom_priced?: boolean
          is_featured?: boolean
          max_circles?: number
          max_students?: number
          max_teachers?: number
          name_ar?: string
          price_lifetime?: number
          price_monthly?: number
          price_yearly?: number
          setup_fee?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_records: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["track_category"] | null
          circle_id: string | null
          created_at: string
          entered_by: string | null
          from_ayah: number | null
          from_surah: number | null
          id: string
          notes: string | null
          record_date: string
          student_id: string
          tenant_id: string
          to_ayah: number | null
          to_surah: number | null
          track_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["track_category"] | null
          circle_id?: string | null
          created_at?: string
          entered_by?: string | null
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          record_date?: string
          student_id: string
          tenant_id: string
          to_ayah?: number | null
          to_surah?: number | null
          track_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["track_category"] | null
          circle_id?: string | null
          created_at?: string
          entered_by?: string | null
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          record_date?: string
          student_id?: string
          tenant_id?: string
          to_ayah?: number | null
          to_surah?: number | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_records_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_records_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      quotas: {
        Row: {
          category: Database["public"]["Enums"]["track_category"] | null
          created_at: string
          from_ayah: number | null
          from_surah: number | null
          id: string
          notes: string | null
          period: string
          student_id: string
          target_amount: number
          tenant_id: string
          to_ayah: number | null
          to_surah: number | null
          track_id: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["track_category"] | null
          created_at?: string
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          period?: string
          student_id: string
          target_amount?: number
          tenant_id: string
          to_ayah?: number | null
          to_surah?: number | null
          track_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["track_category"] | null
          created_at?: string
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          period?: string
          student_id?: string
          target_amount?: number
          tenant_id?: string
          to_ayah?: number | null
          to_surah?: number | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotas_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotas_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          created_at: string
          hits: number
          id: string
          identifier: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          created_at?: string
          hits?: number
          id?: string
          identifier: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          hits?: number
          id?: string
          identifier?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          age: number | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          leave_end: string | null
          leave_start: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age?: number | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age?: number | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          leave_end?: string | null
          leave_start?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          expires_at: string | null
          id: string
          plan_id: string
          provider: string | null
          provider_customer_id: string | null
          provider_ref: string | null
          provider_subscription_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          id?: string
          plan_id: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          progress_entry_mode: Database["public"]["Enums"]["tenant_progress_mode"]
          registration_open: boolean
          settings: Json
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          students_mode: Database["public"]["Enums"]["tenant_students_mode"]
          updated_at: string
          volunteering_open: boolean
        }
        Insert: {
          accent_color?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          progress_entry_mode?: Database["public"]["Enums"]["tenant_progress_mode"]
          registration_open?: boolean
          settings?: Json
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          students_mode?: Database["public"]["Enums"]["tenant_students_mode"]
          updated_at?: string
          volunteering_open?: boolean
        }
        Update: {
          accent_color?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          progress_entry_mode?: Database["public"]["Enums"]["tenant_progress_mode"]
          registration_open?: boolean
          settings?: Json
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          students_mode?: Database["public"]["Enums"]["tenant_students_mode"]
          updated_at?: string
          volunteering_open?: boolean
        }
        Relationships: []
      }
      tracks: {
        Row: {
          age_group: string | null
          categories: Database["public"]["Enums"]["track_category"][]
          category: Database["public"]["Enums"]["track_category"]
          created_at: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          categories?: Database["public"]["Enums"]["track_category"][]
          category: Database["public"]["Enums"]["track_category"]
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          categories?: Database["public"]["Enums"]["track_category"][]
          category?: Database["public"]["Enums"]["track_category"]
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          account_status: string
          circle_id: string | null
          leave_end: string | null
          leave_start: string | null
          created_at: string
          id: string
          is_volunteer: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          track_id: string | null
          user_id: string
        }
        Insert: {
          account_status?: string
          circle_id?: string | null
          leave_end?: string | null
          leave_start?: string | null
          created_at?: string
          id?: string
          is_volunteer?: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          track_id?: string | null
          user_id: string
        }
        Update: {
          account_status?: string
          circle_id?: string | null
          leave_end?: string | null
          leave_start?: string | null
          created_at?: string
          id?: string
          is_volunteer?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          track_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_applications: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          note: string | null
          phone: string | null
          preferred_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          note?: string | null
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          note?: string | null
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_student: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_circle: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_circles_in_track: {
        Args: { _tenant_id: string; _track_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_progress_entries: {
        Args: { _circle_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_role_assignment: {
        Args: {
          _actor: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
        }
        Returns: boolean
      }
      can_manage_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_track: {
        Args: { _track_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_track_entries: {
        Args: { _tenant_id: string; _track_id: string; _user_id: string }
        Returns: boolean
      }
      can_record_academic: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_circle: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_manager: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      my_tenant_ids: { Args: never; Returns: string[] }
      platform_revenue_monthly: {
        Args: { _months?: number }
        Returns: {
          currency: string
          invoice_count: number
          month: string
          paid_total: number
        }[]
      }
      platform_tenant_usage_summary: {
        Args: never
        Returns: {
          circles_limit: number
          circles_used: number
          students_limit: number
          students_used: number
          teachers_limit: number
          teachers_used: number
          tenant_id: string
          usage_pct: number
        }[]
      }
      rate_limit_hit: {
        Args: {
          _bucket: string
          _identifier: string
          _limit: number
          _window_seconds: number
        }
        Returns: boolean
      }
      tenant_effective_features: {
        Args: { _tenant_id: string }
        Returns: {
          enabled: boolean
          feature_key: string
        }[]
      }
      tenant_has_feature: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      tenant_plan_limits: {
        Args: { _tenant_id: string }
        Returns: {
          max_circles: number
          max_students: number
          max_teachers: number
          plan_id: string
          plan_name: string
        }[]
      }
      tenant_subscription_active: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      tenant_usage: {
        Args: { _tenant_id: string }
        Returns: {
          circles: number
          students: number
          teachers: number
        }[]
      }
      tenant_within_limit: {
        Args: { _kind: string; _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "platform_owner"
        | "tenant_admin"
        | "admin_deputy"
        | "academic_deputy"
        | "supervisor"
        | "teacher"
        | "student"
      attendance_status: "present" | "absent" | "excused"
      billing_period: "monthly" | "yearly" | "lifetime"
      invoice_status: "draft" | "open" | "paid" | "void" | "refunded" | "failed"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "canceled"
        | "expired"
      request_status: "new" | "contacted" | "approved" | "rejected"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      tenant_progress_mode: "teacher" | "supervisor" | "both"
      tenant_status: "active" | "suspended" | "pending"
      tenant_students_mode: "records" | "accounts"
      track_category:
        | "hifz_new"
        | "thabit_new"
        | "review_general"
        | "review_recent"
        | "review_distant"
        | "tilawa"
      webhook_event_status: "received" | "processed" | "ignored" | "error"
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
      app_role: [
        "platform_owner",
        "tenant_admin",
        "admin_deputy",
        "academic_deputy",
        "supervisor",
        "teacher",
        "student",
      ],
      attendance_status: ["present", "absent", "excused"],
      billing_period: ["monthly", "yearly", "lifetime"],
      invoice_status: ["draft", "open", "paid", "void", "refunded", "failed"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "canceled",
        "expired",
      ],
      request_status: ["new", "contacted", "approved", "rejected"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      tenant_progress_mode: ["teacher", "supervisor", "both"],
      tenant_status: ["active", "suspended", "pending"],
      tenant_students_mode: ["records", "accounts"],
      track_category: [
        "hifz_new",
        "thabit_new",
        "review_general",
        "review_recent",
        "review_distant",
        "tilawa",
      ],
      webhook_event_status: ["received", "processed", "ignored", "error"],
    },
  },
} as const
