import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitPlanRequest } from "@/lib/requests.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BillingPeriod } from "@/lib/pricing";
import { BILLING_LABELS } from "@/lib/pricing";

const schema = z.object({
  tenant_name: z.string().trim().min(2, "اسم المقرأة قصير جدًا").max(120),
  contact_name: z.string().trim().min(2, "الاسم قصير جدًا").max(120),
  email: z.string().trim().email("البريد الإلكتروني غير صحيح").max(255),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export function PlanRequestDialog({
  open,
  onOpenChange,
  planId,
  planName,
  period,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string | null;
  planName: string;
  period: BillingPeriod;
}) {
  const [busy, setBusy] = useState(false);
  const sendRequest = useServerFn(submitPlanRequest);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      tenant_name: form.get("tenant_name"),
      contact_name: form.get("contact_name"),
      email: form.get("email"),
      phone: form.get("phone") || undefined,
      notes: form.get("notes") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }

    setBusy(true);
    try {
      await sendRequest({
        data: {
          planId,
          billingPeriod: period,
          tenantName: parsed.data.tenant_name,
          contactName: parsed.data.contact_name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          notes: parsed.data.notes ?? null,
        },
      });
    } catch {
      setBusy(false);
      toast.error("تعذّر إرسال الطلب، حاولي مرة أخرى.");
      return;
    }
    setBusy(false);
    toast.success("وصلنا طلبك — سنتواصل معك خلال ٤٨ ساعة.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>طلب باقة {planName}</DialogTitle>
          <DialogDescription>
            نوع الدفع المختار: {BILLING_LABELS[period]}. نجهّز حساب مقرأتك ورابطها الخاص ونتواصل معك.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tenant_name">اسم المقرأة</Label>
            <Input id="tenant_name" name="tenant_name" required placeholder="مقرأة نور" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact_name">اسمك</Label>
            <Input id="contact_name" name="contact_name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" name="email" type="email" required dir="ltr" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
            <Input id="phone" name="phone" dir="ltr" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="عدد الطالبات، المسارات، أي طلب خاص…" />
          </div>
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            إرسال الطلب
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
