import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveTrack, setTrackStatus, deleteTrack } from "@/lib/academic.functions";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Route as RouteIcon, Sparkles, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { visibleTenantNav } from "@/components/layout/nav";
import { LoadingBlock, EmptyState, FeatureLockedState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { TRACK_CATEGORY_LABELS, TRACK_CATEGORY_KEYS, trackCategoryList } from "@/lib/track-categories";
import type { TrackRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/app/$slug/tracks")({
  head: () => ({
    meta: [
      { title: "المسارات — سُحُب" },
      { name: "description", content: "إدارة المسارات التي تضم حلقات المقرأة بمناهجها وفئتها العمرية وتوجهها." },
      { property: "og:title", content: "المسارات — سُحُب" },
      { property: "og:description", content: "إدارة مسارات الحلقات في مقرأة على منصة سُحُب." },
    ],
  }),
  component: TracksPage,
});

type EditState = {
  id: string | null;
  name: string;
  categories: string[];
  age_group: string;
  notes: string;
};

function emptyEdit(): EditState {
  return { id: null, name: "", categories: [TRACK_CATEGORY_KEYS[0]!], age_group: "", notes: "" };
}

function TracksPage() {
  const { tenant, canManage, canRead, loading, hasFeature, featuresLoading, canRecord, isCircleScopedOnly } = useTenantContext();
  const qc = useQueryClient();
  const saveTrackFn = useServerFn(saveTrack);
  const setTrackStatusFn = useServerFn(setTrackStatus);
  const deleteTrackFn = useServerFn(deleteTrack);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);

  const tracksQuery = useQuery({
    queryKey: ["tracks", tenant?.id],
    enabled: canRead && !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, name, category, categories, age_group, notes, status, sort_order, created_at")
        .eq("tenant_id", tenant!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (values: EditState) => {
      const categories = TRACK_CATEGORY_KEYS.filter((k) =>
        values.categories.includes(k),
      ) as TrackRow["categories"];
      await saveTrackFn({
        data: {
          slug: tenant!.slug,
          id: values.id,
          name: values.name.trim(),
          category: categories[0]!,
          categories,
          age_group: values.age_group.trim() || null,
          notes: values.notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ المسار");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["tracks"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر الحفظ"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      await setTrackStatusFn({ data: { slug: tenant!.slug, id, status } });
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      void qc.invalidateQueries({ queryKey: ["tracks"] });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر تحديث الحالة"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteTrackFn({ data: { slug: tenant!.slug, id } });
    },
    onSuccess: () => {
      toast.success("تم حذف المسار");
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["tracks"] });
      void qc.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message || "تعذّر الحذف — قد يكون المسار مرتبطًا بحلقات أو سجلات. عطّليه بدلًا من حذفه.",
      ),
  });



  if (loading || featuresLoading) return <LoadingBlock />;

  if (!tenant || !canRead) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          title={tenant ? "لا تملكين صلاحية الوصول لهذه المقرأة" : "المقرأة غير موجودة"}
          description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
          action={
            <Button asChild>
              <Link to="/dashboard">العودة للوحتي</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!hasFeature("tracks")) {
    return (
      <AppShell
        brandName={tenant.name}
        brandSubtitle="المسارات"
        logoUrl={tenant.logo_url}
        nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
        title="المسارات"
        crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المسارات" }]}
      >
        <FeatureLockedState tenantSlug={tenant.slug} />
      </AppShell>
    );
  }

  const rows = tracksQuery.data ?? [];

  function toggleCategory(key: string) {
    setEdit((p) => {
      if (!p) return p;
      const has = p.categories.includes(key);
      const next = has ? p.categories.filter((c) => c !== key) : [...p.categories, key];
      return { ...p, categories: next };
    });
  }

  return (
    <AppShell
      brandName={tenant.name}
      brandSubtitle="المسارات"
      logoUrl={tenant.logo_url}
      nav={visibleTenantNav(tenant.slug, hasFeature, canManage, canRecord, isCircleScopedOnly)}
      title="المسارات"
      description="المسار يجمع حلقات بنفس الاسم والفئة العمرية والتوجه، ويمكن أن يضم أكثر من منهج معًا: حفظ جديد، تثبيت، مراجعة قريبة أو بعيدة، مراجعة عامة، وتلاوة."
      crumbs={[{ label: tenant.name, to: "/app/$slug", params: { slug: tenant.slug } }, { label: "المسارات" }]}
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setEdit(emptyEdit())}>
            <Plus className="size-4" />
            مسار جديد
          </Button>
        ) : undefined
      }
    >
      {tracksQuery.isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<RouteIcon className="size-6" />}
          title="لا توجد مسارات بعد"
          description="ابدئي بمسار واحد مثل «سراج»، واختاري له المناهج التي تسير عليها حلقاته."
          action={canManage ? <Button onClick={() => setEdit(emptyEdit())}>إنشاء أول مسار</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const cats = trackCategoryList(t);
            const active = t.status === "active";
            return (
              <article
                key={t.id}
                className="surface-panel group relative flex flex-col gap-4 p-5 transition-shadow hover:shadow-lifted"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <RouteIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-lg font-bold">{t.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users2 className="size-3.5" />
                      {t.age_group || "كل الأعمار"}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="تعديل المسار"
                      className="opacity-70 transition-opacity group-hover:opacity-100"
                      onClick={() =>
                        setEdit({
                          id: t.id,
                          name: t.name,
                          categories: cats.length > 0 ? trackKeysOf(t) : [TRACK_CATEGORY_KEYS[0]!],
                          age_group: t.age_group ?? "",
                          notes: t.notes ?? "",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف المسار"
                      className="text-destructive opacity-70 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => setDeleting({ id: t.id, name: t.name })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {cats.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {t.notes ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.notes}</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3">
                  <span
                    className={
                      active
                        ? "flex items-center gap-1.5 text-xs font-medium text-success"
                        : "flex items-center gap-1.5 text-xs text-muted-foreground"
                    }
                  >
                    <span
                      className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground/50"}`}
                    />
                    {active ? "نشط" : "متوقف"}
                  </span>
                  {canManage ? (
                    <Switch
                      checked={active}
                      onCheckedChange={(checked) =>
                        toggleStatus.mutate({ id: t.id, status: checked ? "active" : "inactive" })
                      }
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{edit?.id ? "تعديل المسار" : "مسار جديد"}</DialogTitle>
            <DialogDescription>
              اختاري كل المناهج التي يسير عليها المسار — يمكن اختيار أكثر من منهج معًا.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="t-name">اسم المسار</Label>
              <Input
                id="t-name"
                value={edit?.name ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="مثال: سراج"
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-gold" />
                مناهج المسار
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRACK_CATEGORY_KEYS.map((k) => {
                  const checked = edit?.categories.includes(k) ?? false;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleCategory(k)}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-right text-sm transition-colors ${
                        checked
                          ? "border-primary bg-primary-soft text-primary font-medium"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded-[5px] border ${
                          checked ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {checked ? (
                          <span className="size-1.5 rounded-[2px] bg-primary-foreground" />
                        ) : null}
                      </span>
                      {TRACK_CATEGORY_LABELS[k]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                مثال: مسار «سراج» يمكن أن يشمل حفظ جديد + مراجعة قريبة + مراجعة بعيدة معًا.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-age">الفئة العمرية</Label>
              <Input
                id="t-age"
                value={edit?.age_group ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, age_group: e.target.value } : p))}
                placeholder="مثال: الأطفال ٧–١٠"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-notes">ملاحظات</Label>
              <Textarea
                id="t-notes"
                rows={3}
                value={edit?.notes ?? ""}
                onChange={(e) => setEdit((p) => (p ? { ...p, notes: e.target.value } : p))}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => edit && save.mutate(edit)}
              disabled={save.isPending || !edit?.name.trim() || (edit?.categories.length ?? 0) === 0}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display">حذف المسار</DialogTitle>
            <DialogDescription>
              سيتم حذف «{deleting?.name}» نهائيًا. إن كانت له حلقات أو سجلات مرتبطة فلن يُحذف — عطّليه بدلًا من ذلك.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : "حذف نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** مفاتيح المناهج المخزّنة للمسار (مع دعم المسارات القديمة ذات المنهج الواحد) */
function trackKeysOf(track: { category?: string | null; categories?: string[] | null }): string[] {
  const list = track.categories && track.categories.length > 0 ? track.categories : [track.category ?? ""];
  const filtered = TRACK_CATEGORY_KEYS.filter((k) => list.includes(k));
  return filtered.length > 0 ? filtered : [TRACK_CATEGORY_KEYS[0]!];
}
