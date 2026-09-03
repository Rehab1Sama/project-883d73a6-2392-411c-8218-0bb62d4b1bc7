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
  /** لديها دور نائبة أكاديمية (بغض النظر عن وجود مسار مسنَد لها أم لا) */
  isAcademicDeputy: boolean;
  /**
   * قائمة المسارات المسندة لها فعليًا كنائبة أكاديمية. مصفوفة فارغة تعني:
   * إما ليست نائبة أكاديمية، أو نائبة أكاديمية بلا مسار مسنَد بعد — وفي
   * الحالتين لا تُدير ولا ترى أي مسار/حلقة حتى تُقيَّد بمسار محدد.
   * ⚠️ لا يوجد هنا "نطاق كامل" ضمني: عدم التقييد = بلا صلاحية، وليس العكس.
   */
  myTrackScopes: string[];
  /**
   * قائمة الحلقات المسندة لها فعليًا كمعلمة/مشرفة. مصفوفة فارغة تعني:
   * إما ليست معلمة/مشرفة، أو معلمة/مشرفة بلا حلقة مسندة بعد — وفي
   * الحالتين لا ترى أي حلقة حتى تُقيَّد بحلقة محددة.
   */
  myCircleScopes: string[];
  /** هل تستطيع إدارة (إضافة/تعديل/حذف) هذا المسار / حلقة تابعة له؟ */
  canManageTrack: (trackId: string | null | undefined) => boolean;
  /** هل تستطيع رؤية هذه الحلقة تحديداً؟ (بحسب نطاقها: قيادة/نائبة أكاديمية لمسارها/معلمة أو مشرفة لحلقتها) */
  canViewCircle: (circle: { id: string; track_id?: string | null }) => boolean;
  /** هل تستطيع تسجيل الأنصبة/التقدم/الحضور لهذه الحلقة تحديداً؟ */
  canRecordForCircle: (circleId: string | null | undefined) => boolean;
  /** هل تستطيع إدارة (إضافة/تعديل/حذف) طالبة تنتمي إلى هذه المسارات (إن عُرفت)؟ */
  canManageStudentInTracks: (studentTrackIds: string[]) => boolean;
  /**
   * معلمة/مشرفة مقصورة على حلقتها فقط (ليست قيادة ولا نائبة أكاديمية ولا
   * مالكة منصة) — تُستخدم لتقليص القائمة الجانبية إلى صفحة حلقتها ورفع
   * الأنصبة فقط.
   */
  isCircleScopedOnly: boolean;
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
 *  - نائبة أكاديمية (academic_deputy): فقط المسار/المسارات المسنَدة لها
 *    صراحة عبر track_id من صفحة المتطوعات (myTrackScopes). بلا مسار
 *    مسنَد = بلا صلاحية إطلاقًا (لا رؤية ولا إدارة)، وليس العكس.
 *  - معلمة / مشرفة: فقط حلقتها/حلقاتها المسنَدة لها صراحة عبر circle_id
 *    (myCircleScopes). بلا حلقة مسنَدة = بلا صلاحية إطلاقًا. القراءة
 *    والإدخال (أنصبة/تقدم/حضور) مقصوران على حلقتها، وبحسب إعداد
 *    progress_entry_mode.
 *
 * ⚠️ هذه القيم للعرض في الواجهة فقط (إخفاء/إظهار أزرار). التطبيق الفعلي
 * والملزم للصلاحيات يتم عبر سياسات RLS — انظري
 * supabase/migrations/20260902000000_scope_academic_and_teacher_access.sql.
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
  // ⚠️ لا يوجد "نطاق كامل" ضمني هنا. فقط الصفوف المقيَّدة فعليًا بمسار
  // تمنح صلاحية. نائبة أكاديمية بلا مسار مسنَد = مصفوفة فارغة = بلا صلاحية
  // إطلاقًا حتى تُقيَّد بمسار من صفحة المتطوعات.
  const myTrackScopes: string[] = academicRows.map((r) => r.track_id).filter(Boolean) as string[];

  const teacherSupervisorRows = myRoleRows.filter((r) => r.role === "teacher" || r.role === "supervisor");
  const hasTeacherOrSupervisor = teacherSupervisorRows.length > 0;
  // نفس المبدأ: فقط الصفوف المقيَّدة فعليًا بحلقة تمنح صلاحية رؤية.
  const myCircleScopes: string[] = teacherSupervisorRows.map((r) => r.circle_id).filter(Boolean) as string[];

  const canManage = isPlatformOwner || myRoles.some(isManagerRole);

  function canManageTrack(trackId: string | null | undefined): boolean {
    if (isPlatformOwner || canManage) return true;
    if (!isAcademicDeputy || !trackId) return false;
    return myTrackScopes.includes(trackId);
  }

  function canViewCircle(circle: { id: string; track_id?: string | null }): boolean {
    if (isPlatformOwner || canManage) return true;
    if (isAcademicDeputy && circle.track_id && myTrackScopes.includes(circle.track_id)) return true;
    if (hasTeacherOrSupervisor && myCircleScopes.includes(circle.id)) return true;
    return false;
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

  // ⚠️ نفس مبدأ عدم التقييد = بلا صلاحية: صف بلا circle_id لا يمنح تسجيلًا
  // في أي حلقة، بل لا يمنح شيئًا حتى تُقيَّد المعلمة/المشرفة بحلقة محددة.
  function canRecordForCircle(circleId: string | null | undefined): boolean {
    if (!circleId) return false;
    let allowed = false;
    if (isTeacher && (mode === "teacher" || mode === "both")) {
      const teacherRows = myRoleRows.filter((r) => r.role === "teacher");
      allowed = allowed || teacherRows.some((r) => r.circle_id === circleId);
    }
    if (isSupervisor && (mode === "supervisor" || mode === "both")) {
      const supervisorRows = myRoleRows.filter((r) => r.role === "supervisor");
      allowed = allowed || supervisorRows.some((r) => r.circle_id === circleId);
    }
    return allowed;
  }

  function canManageStudentInTracks(studentTrackIds: string[]): boolean {
    if (isPlatformOwner || canManage) return true;
    if (!isAcademicDeputy) return false;
    if (studentTrackIds.length === 0) return true; // طالبة غير مسندة لأي مسار بعد
    return studentTrackIds.some((t) => myTrackScopes.includes(t));
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
    canViewCircle,
    canRecordForCircle,
    canManageStudentInTracks,
    canRecord,
    isCircleScopedOnly: !isPlatformOwner && !canManage && !isAcademicDeputy && hasTeacherOrSupervisor,
    hasFeature,
    featuresLoading: featuresQuery.isLoading,
    loading: loading || tenantQuery.isLoading,
  };
}
