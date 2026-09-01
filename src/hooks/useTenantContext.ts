import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { isManagerRole, type AppRole } from "@/lib/roles";
import type { TenantProgressMode } from "@/lib/types";

export type TenantContext = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    students_mode: string;
    progress_entry_mode: TenantProgressMode;
  } | null;
  myRoles: AppRole[];
  canRead: boolean;
  /** إدارة عامة على مستوى المقرأة (قائدة/نائبة إدارية/مالكة المنصة) */
  canManage: boolean;
  /** لديها نطاق نائبة أكاديمية واحد على الأقل (كامل المقرأة أو مسار محدد) */
  isAcademicDeputy: boolean;
  /** null تعني: مسؤولة عن كل المسارات. مصفوفة فارغة تعني: ليست نائبة أكاديمية إطلاقاً */
  myTrackScopes: string[] | null;
  /** null تعني: مرتبطة بكل الحلقات (أو ليست معلمة/مشرفة مقيّدة) */
  myCircleScopes: string[] | null;
  /** هل تستطيع إدارة (إضافة/تعديل/حذف) هذا المسار / حلقة تابعة له؟ */
  canManageTrack: (trackId: string | null | undefined) => boolean;
  /** هل تستطيع رؤية هذه الحلقة تحديداً؟ (معلمة/مشرفة مقيّدة) */
  canViewCircleById: (circleId: string | null | undefined) => boolean;
  /** هل تستطيع تسجيل الأنصبة/التقدم/الحضور لهذه الحلقة تحديداً؟ */
  canRecordForCircle: (circleId: string | null | undefined) => boolean;
  /** هل تستطيع إدارة (إضافة/تعديل/حذف) طالبة تنتمي إلى هذه المسارات (إن عُرفت)؟ */
  canManageStudentInTracks: (studentTrackIds: string[]) => boolean;
  /** هل تستطيع إدخال الأنصبة/التقدم/الحضور وفق إعداد المقرأة (على أي حلقة مسموح بها)؟ */
  canRecord: boolean;
  /**
   * هل ميزة معينة (بمفتاحها) مفعّلة فعليًا لهذه المقرأة الآن؟ (باقتها +
   * أي استثناء يدوي من مالكة المنصة). مالكة المنصة تتجاوز هذا القيد دائمًا
   * (للدعم الفني). لا تُستخدم هذه القيمة للحماية الفعلية — الالتزام
   * الملزم عبر RLS — بل لإخفاء/إظهار وحجب الوصول على مستوى الواجهة فقط.
   */
  hasFeature: (key: string) => boolean;
  /** هل ما زالت بيانات الميزات الفعلية قيد التحميل؟ */
  featuresLoading: boolean;
  loading: boolean;
};

/**
 * يُحمّل بيانات المقرأة الحالية ويحدد صلاحيات المستخدمة داخل الرابط /app/$slug.
 *
 * مستويات الصلاحية:
 *  - القيادة (tenant_admin / admin_deputy) ومالكة المنصة: كل شيء، بلا قيود.
 *  - نائبة أكاديمية (academic_deputy): كل شيء، لكن مقيّد بمسارها إن حُدّد
 *    لها مسار من صفحة المتطوعات (myTrackScopes). بلا مسار محدد = كل
 *    المقرأة.
 *  - معلمة / مشرفة: قراءة فقط لحلقتها المحددة (myCircleScopes)، وإدخال
 *    الأنصبة/التقدم/الحضور لهذه الحلقة فقط، وبحسب إعداد progress_entry_mode.
 *
 * ⚠️ هذه القيم للعرض في الواجهة فقط (إخفاء/إظهار أزرار). التطبيق الفعلي
 * والملزم للصلاحيات يتم عبر سياسات RLS في supabase/migration_scoped_permissions.sql.
 */
export function useTenantContext(): TenantContext {
  const params = useParams({ strict: false });
  const slug = String(params.slug ?? "");
  const { roles, isPlatformOwner, loading } = useAuth();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, accent_color, students_mode, progress_entry_mode",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data ?? null;
  const featuresQuery = useTenantFeatures(tenant?.id);

  function hasFeature(key: string): boolean {
    if (isPlatformOwner) return true; // دعم فني: مالكة المنصة تتخطى قيود الباقة دائمًا
    return featuresQuery.data?.[key] ?? false;
  }

  const myRoleRows = tenant ? roles.filter((r) => r.tenant_id === tenant.id) : [];
  const myRoles = myRoleRows.map((r) => r.role);

  const academicRows = myRoleRows.filter((r) => r.role === "academic_deputy");
  const isAcademicDeputy = academicRows.length > 0;
  // null = بلا قيد مسار (نطاق كامل المقرأة)؛ وإلا قائمة المسارات المسندة إليها
  const myTrackScopes: string[] | null = isAcademicDeputy
    ? academicRows.some((r) => !r.track_id)
      ? null
      : (academicRows.map((r) => r.track_id).filter(Boolean) as string[])
    : [];

  const teacherSupervisorRows = myRoleRows.filter((r) => r.role === "teacher" || r.role === "supervisor");
  const hasTeacherOrSupervisor = teacherSupervisorRows.length > 0;
  const myCircleScopes: string[] | null = hasTeacherOrSupervisor
    ? teacherSupervisorRows.some((r) => !r.circle_id)
      ? null
      : (teacherSupervisorRows.map((r) => r.circle_id).filter(Boolean) as string[])
    : [];

  const canManage = isPlatformOwner || myRoles.some(isManagerRole);

  function canManageTrack(trackId: string | null | undefined): boolean {
    if (isPlatformOwner || canManage) return true;
    if (!isAcademicDeputy) return false;
    if (myTrackScopes === null) return true; // نائبة أكاديمية بلا قيد
    if (!trackId) return false;
    return myTrackScopes.includes(trackId);
  }

  function canViewCircleById(circleId: string | null | undefined): boolean {
    if (isPlatformOwner || canManage || isAcademicDeputy) return true;
    if (!hasTeacherOrSupervisor) return false;
    if (myCircleScopes === null) return true;
    if (!circleId) return false;
    return myCircleScopes.includes(circleId);
  }

  const mode = tenant?.progress_entry_mode ?? "both";
  const isTeacher = myRoles.includes("teacher");
  const isSupervisor = myRoles.includes("supervisor");
  // ⚠️ إدخال الأنصبة/التقدم مقصور على المعلمة/المشرفة بحسب إعداد المقرأة
  // فقط. القيادة والنائبة الأكاديمية ومالكة المنصة لا يُمنحن هذه الصلاحية
  // هنا عمدًا (حتى لو كنّ يدرن كل شيء آخر) — القرار مقصود من صاحبة المنتج.
  const canRecord =
    (isTeacher && (mode === "teacher" || mode === "both")) ||
    (isSupervisor && (mode === "supervisor" || mode === "both"));

  function canRecordForCircle(circleId: string | null | undefined): boolean {
    let allowed = false;
    if (isTeacher && (mode === "teacher" || mode === "both")) {
      const teacherRows = myRoleRows.filter((r) => r.role === "teacher");
      allowed = allowed || teacherRows.some((r) => !r.circle_id || (!!circleId && r.circle_id === circleId));
    }
    if (isSupervisor && (mode === "supervisor" || mode === "both")) {
      const supervisorRows = myRoleRows.filter((r) => r.role === "supervisor");
      allowed = allowed || supervisorRows.some((r) => !r.circle_id || (!!circleId && r.circle_id === circleId));
    }
    return allowed;
  }

  function canManageStudentInTracks(studentTrackIds: string[]): boolean {
    if (isPlatformOwner || canManage) return true;
    if (!isAcademicDeputy) return false;
    if (myTrackScopes === null) return true;
    if (studentTrackIds.length === 0) return true; // طالبة غير مسندة لأي حلقة بعد
    return studentTrackIds.some((t) => myTrackScopes!.includes(t));
  }

  return {
    tenant,
    myRoles,
    canRead: isPlatformOwner || myRoles.length > 0,
    canManage,
    isAcademicDeputy,
    myTrackScopes,
    myCircleScopes,
    canManageTrack,
    canViewCircleById,
    canRecordForCircle,
    canManageStudentInTracks,
    canRecord,
    hasFeature,
    featuresLoading: featuresQuery.isLoading,
    loading: loading || tenantQuery.isLoading,
  };
}
