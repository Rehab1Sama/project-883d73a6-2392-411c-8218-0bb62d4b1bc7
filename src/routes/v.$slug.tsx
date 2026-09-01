import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowLeft, HeartHandshake, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useTenantLogo } from "@/lib/tenant-branding";
import { VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/volunteers";
import { toast } from "sonner";

type PublicTenantRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  short_description: string | null;
  status: string;
  volunteering_open: boolean | null;
};

const schema = z.object({
  full_name: z.string().min(2, "الاسم الكامل مطلوب"),
  email: z.string().email("البريد غير صالح").optional().or(z.literal("")),
  phone: z.string().min(9, "رقم الجوال قصير").optional().or(z.literal("")),
  preferred_role: z.enum(["teacher", "supervisor", "academic_deputy", "admin_deputy"]),
  note: z.string().max(500, "ملاحظة طويلة").optional(),
});

export const Route = createFileRoute("/v/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `تسجيل المتطوعات — مقرأة ${params.slug}` },
      { name: "description", content: "تسجيل متطوعات المقرأة في المنصة كمعلمات أو مشرفات أو مسؤولات مسارات." },
      { property: "og:title", content: `تسجيل المتطوعات — مقرأة ${params.slug}` },
      { property: "og:description", content: "سجّلي بياناتك للانضمام لفريق المقرأة على المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VolunteerPublicPage,
});

function VolunteerPublicPage() {
  const { slug } = useParams({ from: "/v/$slug" });
  const [errors, setErrors] = useState<Partial<Record<"full_name" | "email" | "phone" | "note", string>>>({});

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("tenants")
        .select("id, name, slug, logo_url, primary_color, accent_color, short_description, status, volunteering_open")
        .eq("slug", slug)
        .maybeSingle()) as { data: PublicTenantRow | null; error: Error | null };
      if (error) throw error;
      return data;
    },
  });

  useTenantTheme(tenant?.primary_color ?? null, tenant?.accent_color ?? null);
  const logoUrl = useTenantLogo(tenant?.logo_url);

  const submit = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!tenant?.id) throw new Error("المقرأة غير موجودة");
      const raw = {
        full_name: String(formData.get("full_name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
        preferred_role: String(formData.get("preferred_role") ?? "teacher") as VolunteerRole,
        note: String(formData.get("note") ?? "").trim() || null,
      };
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        parsed.error.issues.forEach((issue) => {
          fieldErrors[issue.path.join(".")] = issue.message;
        });
        setErrors(fieldErrors);
        throw new Error("يرجى تصحيح البيانات");
      }
      setErrors({});
      const insert = {
        tenant_id: tenant.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        preferred_role: parsed.data.preferred_role,
        note: parsed.data.note,
      };
      const { error } = await (supabase as any).from("volunteer_applications").insert(insert);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => toast.success("تم إرسال بياناتك، ستفعّل الإدارة عضويتك قريبًا"),
    onError: (err: Error) => toast.error(err.message || "تعذّر إرسال الطلب"),
  });

  if (isLoading) return <LoadingBlock />;

  if (!tenant || tenant.status === "suspended" || !tenant.volunteering_open) {
    return (
      <main className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title={!tenant ? "لم نجد هذه المقرأة" : "تسجيل المتطوعات مغلق حاليًا"}
            description="تأكدي من الرابط أو تواصلي مع إدارة المقرأة."
            action={
              <Button asChild variant="outline">
                <Link to="/">الصفحة الرئيسية</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="gradient-sky min-h-screen px-5 py-14">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="mx-auto size-20 rounded-2xl bg-card object-contain p-2 shadow-soft" />
          ) : (
            <span className="mx-auto grid size-20 place-items-center rounded-2xl gradient-primary font-display text-2xl font-bold text-primary-foreground">
              {tenant.name.slice(0, 1)}
            </span>
          )}
          <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{tenant.name}</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            هذه الصفحة لمتطوعات المقرأة الحاليات: سجّلي بياناتك ودورك في المقرأة لتُفعَّل عضويتك في المنصة.
          </p>
        </div>

        {submit.isSuccess ? (
          <div className="surface-panel space-y-4 p-6 text-center">
            <HeartHandshake className="mx-auto size-10 text-primary" />
            <h2 className="font-display text-xl font-bold">تم استلام تسجيلك بنجاح</h2>
            <p className="text-sm text-muted-foreground">ستراجع إدارة المقرأة بياناتك وتُفعّل دورك في المنصة.</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/m/$slug" params={{ slug: tenant.slug }}>
                العودة لصفحة المقرأة
              </Link>
            </Button>
          </div>
        ) : (
          <form
            className="surface-panel space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="full_name">الاسم الكامل</Label>
              <Input id="full_name" name="full_name" required />
              {errors.full_name ? <p className="text-xs text-destructive">{errors.full_name}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
              <Input id="email" name="email" type="email" dir="ltr" />
              {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input id="phone" name="phone" type="tel" dir="ltr" required />
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preferred_role">دورك في المقرأة</Label>
              <select
                id="preferred_role"
                name="preferred_role"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="teacher"
              >
                {VOLUNTEER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">الحلقة أو المسار الذي تعملين فيه حاليًا (اختياري)</Label>
              <Textarea id="note" name="note" rows={3} />
              {errors.note ? <p className="text-xs text-destructive">{errors.note}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <HeartHandshake className="size-4" />}
              إرسال التسجيل
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/m/$slug" params={{ slug: tenant.slug }}>
                <ArrowLeft className="size-4" />
                العودة لصفحة المقرأة
              </Link>
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
