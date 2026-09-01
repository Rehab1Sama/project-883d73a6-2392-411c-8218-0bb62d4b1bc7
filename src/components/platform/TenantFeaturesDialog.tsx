import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LoadingBlock } from "@/components/ui-blocks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFeatureCatalog, useTenantFeatures } from "@/hooks/useTenantFeatures";

type Props = { tenantId: string; tenantName: string };

/** تفعيل/تعطيل الميزات لمقرأة واحدة فقط (خاص بمالكة المنصة) */
export function TenantFeaturesDialog({ tenantId, tenantName }: Props) {
  const qc = useQueryClient();
  const catalog = useFeatureCatalog();
  const features = useTenantFeatures(tenantId);

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("tenant_features")
        .upsert({ tenant_id: tenantId, feature_key: key, enabled }, { onConflict: "tenant_id,feature_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant-features", tenantId] });
      toast.success("تم تحديث الميزة لهذه المقرأة");
    },
    onError: () => toast.error("تعذّر تحديث الميزة"),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`ميزات ${tenantName}`}>
          <SlidersHorizontal className="size-4" />
          الميزات
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ميزات {tenantName}</DialogTitle>
          <DialogDescription>
            التفعيل هنا يخصّ هذه المقرأة وحدها ولا يؤثر على بقية المقارئ.
          </DialogDescription>
        </DialogHeader>
        {catalog.isLoading || features.isLoading ? (
          <LoadingBlock />
        ) : (
          <ul className="space-y-3">
            {catalog.data?.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{f.name_ar}</p>
                  {f.description_ar && (
                    <p className="text-xs text-muted-foreground">{f.description_ar}</p>
                  )}
                </div>
                <Switch
                  checked={features.data?.[f.key] ?? false}
                  disabled={toggle.isPending}
                  onCheckedChange={(checked) => toggle.mutate({ key: f.key, enabled: checked })}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
