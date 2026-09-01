import type { Database } from "@/integrations/supabase/types";

export type TrackRow = Database["public"]["Tables"]["tracks"]["Row"];
export type CircleRow = Database["public"]["Tables"]["circles"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type QuotaRow = Database["public"]["Tables"]["quotas"]["Row"];
export type ProgressRecordRow = Database["public"]["Tables"]["progress_records"]["Row"];
export type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type TenantProgressMode = Database["public"]["Enums"]["tenant_progress_mode"];

export type ScheduleSlot = { day: string; time: string };
