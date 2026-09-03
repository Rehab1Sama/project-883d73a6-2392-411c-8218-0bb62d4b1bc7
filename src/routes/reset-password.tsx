import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "تعيين كلمة مرور جديدة — سُحُب" }],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف").max(72);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // رابط الإيميل يُنشئ جلسة "استرجاع" مؤقتة تلقائيًا عبر Supabase عند
    // فتح هذا الرابط. نتأكد إن الجلسة صارت جاهزة قبل عرض النموذج.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = form.get("password");
    const confirm = form.get("confirm");
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (error) {
      toast.error("تعذّر تحديث كلمة المرور. جرّبي طلب رابط جديد.");
      return;
    }
    setDone(true);
    toast.success("تم تحديث كلمة المرور");
    setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1200);
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
        {done ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold">تم تحديث كلمة المرور</h1>
            <p className="text-sm text-muted-foreground">جارٍ تحويلك إلى لوحتك...</p>
          </div>
        ) : !ready ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-semibold">رابط غير صالح أو منتهي</h1>
            <p className="text-sm text-muted-foreground">
              افتحي رابط إعادة تعيين كلمة المرور من بريدك مباشرة، أو اطلبي رابطًا جديدًا.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">رجوع لتسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">كلمة مرور جديدة</h1>
              <p className="text-sm text-muted-foreground">اختاري كلمة مرور جديدة لحسابك.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-pass">كلمة المرور الجديدة</Label>
              <Input id="rp-pass" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-pass2">تأكيد كلمة المرور</Label>
              <Input id="rp-pass2" name="confirm" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "تحديث كلمة المرور"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
