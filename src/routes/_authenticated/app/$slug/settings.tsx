import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Eye, HeartHandshake, FileText, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { ThemePreview } from "@/components/ThemePreview";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { TENANT_LOGOS_BUCKET, useTenantLogo } from "@/lib/tenant-branding";
import { PROGRESS_MODE_OPTIONS } from "@/lib/progress";
import { COLOR_PALETTES, PASTEL_COLOR_PALETTES } from "@/lib/color-palettes";
import type { TenantProgressMode } from "@/lib/types";
import {
  PUBLIC_PAGE_LIMITS,
  PUBLIC_PAGE_SHADE_OPTIONS,
  emptyPublicPageContent,
  newPublicPageBlock,
  parsePublicPageContent,
  resolveShadeStyle,
  withPublicPageContent,
  type PublicPageContent,
} from "@/lib/public-page";

export const Route = createFileRoute("/_authenticated/app/$slug/settings")({
  component: TenantBrandingPage,
});

const MANAGER_ROLES = new Set(["tenant_admin", "admin_deputy"]);

type TenantSettingsRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  short_description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  registration_open: boolean;
  volunteering_open: boolean | null;
  students_mode: "records" | "accounts";
  progress_entry_mode: TenantProgressMode;
  status: string;
  settings: unknown;
};

function TenantBrandingPage() {
  const { slug } = useParams({ from: "/_authenticated/app/$slug/settings" });
  const { roles, isPlatformOwner, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tenantQuery = useQuery({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, custom_domain, logo_url, primary_color, accent_color, short_description, contact_email, contact_phone, registration_open, volunteering_open, students_mode, progress_entry_mode, status, settings",
        )
        .eq("slug", slug)
        .maybeSingle() as { data: TenantSettingsRow | null; error: Error | null };
      if (error) throw error;
      return data;
    },
  });

  const tenant = tenantQuery.data;
  const featuresQuery = useTenantFeatures(tenant?.id);
  function hasFeature(key: string): boolean {
    if (isPlatformOwner) return true;
    return featuresQuery.data?.[key] ?? false;
  }
  const [primary, setPrimary] = useState("#2E7D8F");
  const [accent, setAccent] = useState("#C9A227");
  const [registration, setRegistration] = useState(false);
  const [volunteering, setVolunteering] = useState(false);
  const [studentsMode, setStudentsMode] = useState<"records" | "accounts">("records");
  const [progressMode, setProgressMode] = useState<TenantProgressMode>("both");
  const [uploading, setUploading] = useState(false);
  const [publicPage, setPublicPage] = useState<PublicPageContent>(emptyPublicPageContent());

  useEffect(() => {
    if (!tenant) return;
    setPrimary(tenant.primary_color ?? "#2E7D8F");
    setAccent(tenant.accent_color ?? "#C9A227");
    setRegistration(tenant.registration_open);
    setVolunteering(tenant.volunteering_open ?? false);
    setStudentsMode(tenant.students_mode === "accounts" ? "accounts" : "records");
    setProgressMode(tenant.progress_entry_mode ?? "both");
    setPublicPage(parsePublicPageContent(tenant.settings));
  }, [tenant]);

  useTenantTheme(primary, accent);
  const logoUrl = useTenantLogo(tenant?.logo_url);

  const save = useMutation({
    mutationFn: async (values: TablesUpdate<"tenants"> & { volunteering_open?: boolean }) => {
      const { error } = await supabase.from("tenants").update(values as any).eq("id", tenant!.id);
      if (error) throw error;
      return values;
    },
    onSuccess: (values) => {
      toast.success("تم حفظ هوية المقرأة");
      void qc.invalidateQueries({ queryKey: ["tenant", slug] });
      void qc.invalidateQueries({ queryKey: ["public-tenant", slug] });
      void qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      const nextSlug = values.slug;
      if (typeof nextSlug === "string" && nextSlug !== slug) {
        void navigate({ to: "/app/$slug/settings", params: { slug: nextSlug } });
      }
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate") ? "هذا الرابط مستخدم لمقرأة أخرى" : "تعذّر الحفظ — تأكدي من صلاحياتك",
      ),
  });

  async function handleLogo(file: File) {
    if (!tenant) return;
    if (!hasFeature("branding")) {
      toast.error("ميزة الهوية البصرية غير مفعّلة لباقتكم الحالية");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الشعار يجب أن يكون أقل من ٢ ميجابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${tenant.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(TENANT_LOGOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast.error("تعذّر رفع الشعار");
      return;
    }
    save.mutate({ logo_url: path });
  }

  if (loading || tenantQuery.isLoading) return <LoadingBlock />;

  const myRoles = tenant ? roles.filter((r) => r.tenant_id === tenant.id).map((r) => r.role) : [];
  const canEdit = isPlatformOwner || myRoles.some((r) => MANAGER_ROLES.has(r));

  if (!tenant || !canEdit) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "لا تملكين صلاحية تعديل هوية المقرأة" : "المقرأة غير موجودة"}
          description="هذه الصفحة متاحة للقائدة ونائبتها ومالكة المنصة."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const brandingAllowed = hasFeature("branding");
    save.mutate({
      name: String(fd.get("name") ?? "").trim(),
      short_description: String(fd.get("short_description") ?? "").trim() || null,
      contact_email: String(fd.get("contact_email") ?? "").trim() || null,
      contact_phone: String(fd.get("contact_phone") ?? "").trim() || null,
      // الألوان تُرسل فقط لو الميزة مفعّلة، وإلا تفضل قيمة القاعدة كما هي
      // (حتى لو المستخدمة عبثت بالـ state محليًا). القاعدة نفسها ترفض أي
      // تغيير بدون الميزة عبر enforce_tenant_branding_gate، فهذا دفاع إضافي فقط.
      ...(brandingAllowed ? { primary_color: primary, accent_color: accent } : {}),
      registration_open: registration,
      volunteering_open: volunteering,
      students_mode: studentsMode,
      progress_entry_mode: progressMode,
      // محتوى الصفحة التعريفية يُرسل فقط لو الميزة مفعّلة، بنفس منطق
      // الألوان أعلاه — وإلا يبقى المخزّن بالقاعدة كما هو.
      ...(hasFeature("public_page")
        ? { settings: withPublicPageContent(tenant?.settings, publicPage) as any }
        : {}),
      ...(isPlatformOwner
        ? {
            slug: String(fd.get("slug") ?? "").trim().toLowerCase(),
            custom_domain: String(fd.get("custom_domain") ?? "").trim().toLowerCase() || null,
          }
        : {}),
    });
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="هوية المقرأة"
      logoUrl={logoUrl}
      nav={visibleTenantNav(slug, hasFeature, canEdit)}
      title="هوية المقرأة"
      crumbs={[{ label: tenant.name }, { label: "هوية المقرأة" }]}
    >
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <section className="surface-panel space-y-4 p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">البيانات الأساسية</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="name">اسم المقرأة</Label>
            <Input id="name" name="name" defaultValue={tenant.name} required maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="short_description">وصف مختصر</Label>
            <Textarea
              id="short_description"
              name="short_description"
              rows={3}
              maxLength={300}
              defaultValue={tenant.short_description ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="contact_email">بريد المقرأة</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                dir="ltr"
                defaultValue={tenant.contact_email ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact_phone">جوال التواصل</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                dir="ltr"
                defaultValue={tenant.contact_phone ?? ""}
              />
            </div>
          </div>
          {isPlatformOwner ? (
            <div className="grid gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2">
              <p className="text-xs font-medium text-primary sm:col-span-2">
                إعدادات مالكة المنصة — تظهر لك فقط
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="slug">الرابط المختصر</Label>
                <Input
                  id="slug"
                  name="slug"
                  dir="ltr"
                  required
                  maxLength={40}
                  pattern="[a-z0-9-]+"
                  defaultValue={tenant.slug}
                />
                <p className="text-xs text-muted-foreground" dir="ltr">
                  /m/{tenant.slug}
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="custom_domain">النطاق المخصص (اختياري)</Label>
                <Input
                  id="custom_domain"
                  name="custom_domain"
                  dir="ltr"
                  maxLength={120}
                  placeholder="maqraah.com"
                  defaultValue={tenant.custom_domain ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  يُربط بعد توجيه النطاق إلى المنصة.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">فتح التسجيل للطالبات</p>
              <p className="text-xs text-muted-foreground">
                عند التفعيل يظهر زر التسجيل في صفحة المقرأة العامة.
              </p>
            </div>
            <Switch checked={registration} onCheckedChange={setRegistration} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">قبول تطوع المتطوعات</p>
              <p className="text-xs text-muted-foreground">
                عند التفعيل يظهر زر "تطوّعي معنا" في صفحة المقرأة العامة ويُتيح التسجيل العام.
              </p>
            </div>
            <Switch checked={volunteering} onCheckedChange={setVolunteering} />
          </div>
          <div className="space-y-2 rounded-xl border border-border p-4">
            <Label>طريقة إدارة الطالبات</Label>
            <p className="text-xs text-muted-foreground">اختاري ما يناسب مقرأتك.</p>
            <div className="grid gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="students_mode"
                  checked={studentsMode === "records"}
                  onChange={() => setStudentsMode("records")}
                  className="mt-1 size-4"
                />
                <span>
                  <span className="block font-medium">سجلات بسيطة</span>
                  <span className="block text-xs text-muted-foreground">
                    الطالبات سجلات يديرها طاقم المقرأة، دون حسابات دخول مستقلة لكل طالبة.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="students_mode"
                  checked={studentsMode === "accounts"}
                  onChange={() => setStudentsMode("accounts")}
                  className="mt-1 size-4"
                />
                <span>
                  <span className="block font-medium">حسابات مستقلة</span>
                  <span className="block text-xs text-muted-foreground">
                    لكل طالبة حساب دخول خاص بها وتتابع إنجازها بنفسها (يتطلب دعوة الطالبات).
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-4">
            <Label>من يدخل الأنصبة والتقدم والحضور؟</Label>
            <p className="text-xs text-muted-foreground">
              تحدّد المقرأة مَن يمكنه تسجيل الأنصبة والتقدم اليومي والحضور.
            </p>
            <div className="grid gap-2">
              {PROGRESS_MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="progress_mode"
                    checked={progressMode === opt.value}
                    onChange={() => setProgressMode(opt.value)}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="block font-medium">{opt.title}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <Label className="text-sm font-medium">الصفحة التعريفية</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              فقرة تعريفية وأقسام حرة (عنوان + نص) تظهرين بها مقرأتكم لزائرات الرابط{" "}
              <span dir="ltr">/m/{tenant.slug}</span>، بترتيب تحددينه أنتِ.
            </p>
            {!hasFeature("public_page") ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                الصفحة التعريفية غير متاحة لباقتكم الحالية. راسلينا لترقية الباقة.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="public_intro">فقرة تعريفية مختصرة</Label>
                  <Textarea
                    id="public_intro"
                    rows={3}
                    maxLength={PUBLIC_PAGE_LIMITS.maxIntro}
                    value={publicPage.intro}
                    onChange={(e) => setPublicPage((p) => ({ ...p, intro: e.target.value }))}
                    placeholder="مثال: مقرأتنا تستقبل الطالبات من عمر ٧ سنوات فأكثر، بمسارات حفظ ومراجعة أسبوعية..."
                  />
                </div>

                <div className="space-y-3">
                  {publicPage.blocks.map((block, i) => (
                    <div key={block.id} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">قسم {i + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={i === 0}
                            onClick={() =>
                              setPublicPage((p) => {
                                const blocks = [...p.blocks];
                                [blocks[i - 1], blocks[i]] = [blocks[i]!, blocks[i - 1]!];
                                return { ...p, blocks };
                              })
                            }
                            aria-label="نقل لأعلى"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={i === publicPage.blocks.length - 1}
                            onClick={() =>
                              setPublicPage((p) => {
                                const blocks = [...p.blocks];
                                [blocks[i], blocks[i + 1]] = [blocks[i + 1]!, blocks[i]!];
                                return { ...p, blocks };
                              })
                            }
                            aria-label="نقل لأسفل"
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPublicPage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== block.id) }))
                            }
                            aria-label="حذف القسم"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={block.title}
                        maxLength={PUBLIC_PAGE_LIMITS.maxTitle}
                        placeholder="عنوان القسم — مثال: مسارات الحفظ"
                        onChange={(e) =>
                          setPublicPage((p) => ({
                            ...p,
                            blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, title: e.target.value } : b)),
                          }))
                        }
                      />
                      <Textarea
                        rows={3}
                        value={block.body}
                        maxLength={PUBLIC_PAGE_LIMITS.maxBody}
                        placeholder="نص القسم"
                        onChange={(e) =>
                          setPublicPage((p) => ({
                            ...p,
                            blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, body: e.target.value } : b)),
                          }))
                        }
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">لون القسم:</span>
                        {PUBLIC_PAGE_SHADE_OPTIONS.map((opt) => {
                          const style = resolveShadeStyle(opt.id, primary, accent);
                          const active = block.shade === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setPublicPage((p) => ({
                                  ...p,
                                  blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, shade: opt.id } : b)),
                                }))
                              }
                              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                                active ? "border-primary ring-1 ring-primary" : "border-border"
                              }`}
                              style={
                                style
                                  ? { backgroundColor: style.background, color: style.foreground, borderColor: style.border }
                                  : undefined
                              }
                              aria-pressed={active}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={publicPage.blocks.length >= PUBLIC_PAGE_LIMITS.maxBlocks}
                  onClick={() => setPublicPage((p) => ({ ...p, blocks: [...p.blocks, newPublicPageBlock()] }))}
                >
                  <Plus className="size-4" />
                  إضافة قسم
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ التغييرات
          </Button>
        </section>

        <aside className="grid gap-6">
          <div className="surface-panel space-y-3 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Eye className="size-4 text-primary" />
              معاينة الثيم
            </h2>
            <p className="text-xs text-muted-foreground">
              تتغيّر المعاينة فورًا مع تغيير الألوان أو الشعار، قبل الحفظ.
            </p>
            <ThemePreview name={tenant.name} logo={tenant.logo_url} primary={primary} accent={accent} />
          </div>

          {hasFeature("public_page") && (publicPage.intro || publicPage.blocks.some((b) => b.title || b.body)) ? (
            <div className="surface-panel space-y-3 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <FileText className="size-4 text-primary" />
                معاينة الصفحة التعريفية
              </h2>
              <div className="space-y-3 rounded-xl border border-border p-4 text-right">
                {publicPage.intro ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{publicPage.intro}</p>
                ) : null}
                {publicPage.blocks.map((b) => {
                  if (!b.title && !b.body) return null;
                  const style = resolveShadeStyle(b.shade, primary, accent);
                  return (
                    <div
                      key={b.id}
                      className="rounded-lg border-t border-border pt-3 first:border-t-0 first:pt-0"
                      style={
                        style
                          ? { backgroundColor: style.background, color: style.foreground, borderColor: style.border, padding: "0.75rem" }
                          : undefined
                      }
                    >
                      {b.title ? (
                        <p className="font-display text-sm font-bold" style={style ? { color: style.foreground } : undefined}>
                          {b.title}
                        </p>
                      ) : null}
                      {b.body ? (
                        <p
                          className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground"
                          style={style ? { color: style.foreground, opacity: 0.9 } : undefined}
                        >
                          {b.body}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="surface-panel space-y-3 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Upload className="size-4 text-primary" />
              الشعار
            </h2>
            {!hasFeature("branding") ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                تخصيص الشعار غير متاح لباقتكم الحالية. راسلينا لترقية الباقة.
              </p>
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt={tenant.name}
                loading="lazy"
                className="size-24 rounded-2xl border border-border object-contain p-2"
              />
            ) : (
              <span className="grid size-24 place-items-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground">
                {tenant.name.slice(0, 1)}
              </span>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={uploading || !hasFeature("branding")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogo(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG أو SVG بخلفية شفافة، وبحجم أقل من ٢ ميجابايت.
            </p>
          </div>

          <div className="surface-panel space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Palette className="size-4 text-primary" />
              الألوان
            </h2>
            {!hasFeature("branding") ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                تخصيص الألوان غير متاح لباقتكم الحالية. راسلينا لترقية الباقة.
              </p>
            ) : null}
            <div className={hasFeature("branding") ? "space-y-4" : "space-y-4 pointer-events-none opacity-50"}>
            <div className="grid gap-1.5">
              <Label htmlFor="primary">اللون الأساسي</Label>
              <div className="flex items-center gap-2">
                <input
                  id="primary"
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="size-10 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="accent">اللون المميّز</Label>
              <div className="flex items-center gap-2">
                <input
                  id="accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="size-10 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>لوحات ألوان جاهزة</Label>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => {
                      setPrimary(palette.primary);
                      setAccent(palette.accent);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted"
                    aria-label={`تطبيق لوحة ${palette.name}`}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-border">
                      <span
                        className="block size-4"
                        style={{ backgroundColor: palette.primary }}
                      />
                      <span
                        className="block size-4"
                        style={{ backgroundColor: palette.accent }}
                      />
                    </span>
                    <span className="text-xs font-medium">{palette.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>لوحات باستيل هادئة</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PASTEL_COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => {
                      setPrimary(palette.primary);
                      setAccent(palette.accent);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted"
                    aria-label={`تطبيق لوحة ${palette.name}`}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-border">
                      <span
                        className="block size-4"
                        style={{ backgroundColor: palette.primary }}
                      />
                      <span
                        className="block size-4"
                        style={{ backgroundColor: palette.accent }}
                      />
                    </span>
                    <span className="text-xs font-medium">{palette.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              تُطبَّق الألوان فورًا على لوحة المقرأة وصفحتها العامة على الرابط{" "}
              <span dir="ltr">/m/{tenant.slug}</span>
            </p>
            </div>
          </div>
        </aside>
      </form>
    </AppShell>
  );
}
