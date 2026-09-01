import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — سُحُب" },
      { name: "description", content: "الدخول إلى منصة سُحُب لإدارة المقارئ القرآنية ومتابعة الحلقات والطالبات." },
      { property: "og:title", content: "تسجيل الدخول — سُحُب" },
      { property: "og:description", content: "الدخول إلى منصة سُحُب لإدارة المقارئ القرآنية." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("البريد الإلكتروني غير صحيح").max(255);
const passwordSchema = z.string().min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف").max(72);
const nameSchema = z.string().trim().min(2, "الاسم قصير جدًا").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const search = useSearch({ from: "/auth" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const nextPath = search.next && search.next.startsWith("/") ? search.next : "/dashboard";

  useEffect(() => {
    if (!loading && user) navigate({ to: nextPath, replace: true });
  }, [loading, user, nextPath, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = z
      .object({ email: emailSchema, password: z.string().min(1, "أدخلي كلمة المرور") })
      .safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error("تعذّر تسجيل الدخول. تأكدي من البريد وكلمة المرور.");
      return;
    }
    toast.success("أهلًا بك");
    navigate({ to: nextPath, replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = z
      .object({ full_name: nameSchema, email: emailSchema, password: passwordSchema })
      .safeParse({
        full_name: form.get("full_name"),
        email: form.get("email"),
        password: form.get("password"),
      });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.full_name },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("تم إنشاء الحساب، تحققي من بريدك لتفعيله");
  }

  async function handleGoogle(): Promise<void> {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("تعذّر الدخول عبر جوجل");
      return;
    }
    if (result.redirected) return;
    navigate({ to: nextPath, replace: true });
  }

  return (
    <div className="gradient-sky flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <span className="grid size-11 place-items-center rounded-xl gradient-primary text-primary-foreground">
          <BookOpen className="size-5" />
        </span>
        <span className="font-display text-2xl font-bold">سُحُب</span>
      </Link>

      <div className="surface-panel w-full max-w-md p-6">
        {sent ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold">تحققي من بريدك</h1>
            <p className="text-sm text-muted-foreground">
              أرسلنا رابط تفعيل إلى بريدك الإلكتروني. بعد التفعيل يمكنك تسجيل الدخول.
            </p>
            <Button variant="outline" onClick={() => setSent(false)}>
              رجوع
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">دخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">البريد الإلكتروني</Label>
                  <Input id="si-email" name="email" type="email" dir="ltr" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-pass">كلمة المرور</Label>
                  <Input id="si-pass" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "تسجيل الدخول"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">الاسم الكامل</Label>
                  <Input id="su-name" name="full_name" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">البريد الإلكتروني</Label>
                  <Input id="su-email" name="email" type="email" dir="ltr" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pass">كلمة المرور</Label>
                  <Input id="su-pass" name="password" type="password" autoComplete="new-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "إنشاء الحساب"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {!sent ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
              المتابعة عبر حساب جوجل
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
