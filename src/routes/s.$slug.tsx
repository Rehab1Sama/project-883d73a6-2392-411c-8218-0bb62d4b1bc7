import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, GraduationCap, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingBlock, EmptyState } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useTenantLogo } from "@/lib/tenant-branding";
import {
  getPublicRegistrationInfo,
  registerStudent,
  type StudentRegistrationResult,
} from "@/lib/student-registration.functions";

export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `تسجيل الطالبات — مقرأة ${params.slug}` },
      {
        name: "description",
        content: "سجّلي في مقرأتك واختاري حلقتك، وستظهر بياناتك ومتابعة حفظك لدى معلمتك ومشرفتك.",
      },
      { property: "og:title", content: `تسجيل الطالبات — مقرأة ${params.slug}` },
      { property: "og:description", content: "رابط تسجيل الطالبات في المقرأة على منصة سُحُب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentRegisterPage,
});

const OTHER = "__other__";

function StudentRegisterPage() {
  const { slug } = useParams({ from: "/s/$slug" });
  const fetchInfo = useServerFn(getPublicRegistrationInfo);
  const submitFn = useServerFn(registerStudent);
  const [circleChoice, setCircleChoice] = useState<string>("");
  const [done, setDone] = useState<StudentRegistrationResult | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ["student-registration-info", slug],
    queryFn: () => fetchInfo({ data: { slug } }),
  });

  useTenantTheme(info?.primary_color ?? null, info?.accent_color ?? null);
  const logoUrl = useTenantLogo(info?.logo_url);

  const withAccounts = info?.students_mode === "accounts";

  const submit = useMutation({
    mutationFn: async (form: FormData) => {
      const value = (key: string) => String(form.get(key) ?? "").trim();
      const ageRaw = value("age");
      const chosen = value("circle_choice");
      return submitFn({
        data: {
          slug,
          full_name: value("full_name"),
          guardian_name: value("guardian_name") || null,
          guardian_phone: value("guardian_phone") || null,
          age: ageRaw ? Number(ageRaw) || null : null,
          country: value("country") || null,
          circle_id: chosen && chosen !== OTHER ? chosen : null,
          track_name: chosen === OTHER ? value("track_name") : null,
          circle_name: chosen === OTHER ? value("circle_name") : null,
          email: withAccounts ? value("email") : null,
          password: withAccounts ? value("password") : null,
        },
      });
    },
    onSuccess: (result) => {
      setDone(result);
      toast.success("تم تسجيلك بنجاح");
    },
    onError: (err: Error) => toast.error(err.message || "تعذّر إكمال التسجيل"),
  });

  if (isLoading) return <LoadingBlock />;

  if (!info || info.status === "suspended" || !info.registration_open) {
    return (
      <main className="gradient-sky flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title={!info ? "لم نجد هذه المقرأة" : "التسجيل مغلق حاليًا"}
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
            <img
              src={logoUrl}
              alt={info.name}
              className="mx-auto size-20 rounded-2xl bg-card object-contain p-2 shadow-soft"
            />
          ) : (
            <span className="mx-auto grid size-20 place-items-center rounded-2xl gradient-primary font-display text-2xl font-bold text-primary-foreground">
              {info.name.slice(0, 1)}
            </span>
          )}
          <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">تسجيل الطالبات</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            {info.name} — سجّلي بياناتك واختاري حلقتك.
            {withAccounts
              ? " ستحصلين على حساب دخول لمتابعة حفظك وحضورك من بوابة الطالبة."
              : " هذه المقرأة تعتمد السجلات فقط، فلا حاجة لبريد ولا كلمة سر."}
          </p>
        </div>

        {done ? (
          <div className="surface-panel space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-primary" />
            <h2 className="font-display text-xl font-bold">تم تسجيلك في {done.circleName}</h2>
            <p className="text-sm text-muted-foreground">
              {done.accountCreated
                ? "يمكنك الآن الدخول ببريدك وكلمة السر لمتابعة حفظك وحضورك."
                : "ستتابع معلمتك حفظك وحضورك من داخل المنصة."}
            </p>
            {done.accountCreated ? (
              <Button asChild className="w-full">
                <Link to="/auth">تسجيل الدخول</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="w-full">
              <Link to="/m/$slug" params={{ slug: info.slug }}>
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
              <Input id="full_name" name="full_name" required minLength={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="age">العمر</Label>
                <Input id="age" name="age" type="number" min={4} max={120} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="country">البلد</Label>
                <Input id="country" name="country" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="guardian_name">اسم وليّ الأمر (اختياري)</Label>
                <Input id="guardian_name" name="guardian_name" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="guardian_phone">جوال وليّ الأمر (اختياري)</Label>
                <Input id="guardian_phone" name="guardian_phone" type="tel" dir="ltr" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="circle_choice">الحلقة</Label>
              <select
                id="circle_choice"
                name="circle_choice"
                required
                value={circleChoice}
                onChange={(e) => setCircleChoice(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  اختاري حلقتك
                </option>
                {info.circles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.track_name} — {c.name}
                  </option>
                ))}
                <option value={OTHER}>حلقتي غير موجودة في القائمة</option>
              </select>
            </div>

            {circleChoice === OTHER ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="track_name">اسم المسار</Label>
                  <Input id="track_name" name="track_name" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="circle_name">اسم الحلقة</Label>
                  <Input id="circle_name" name="circle_name" required />
                </div>
              </div>
            ) : null}

            {withAccounts ? (
              <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" name="email" type="email" dir="ltr" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">كلمة السر</Label>
                  <Input id="password" name="password" type="password" dir="ltr" required minLength={8} />
                </div>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
              إكمال التسجيل
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
