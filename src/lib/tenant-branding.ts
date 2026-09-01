import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const TENANT_LOGOS_BUCKET = "tenant-logos";

/**
 * شعار المقرأة قد يكون رابطًا خارجيًا كاملًا أو مسارًا داخل مخزن الشعارات.
 * هذه الدالة تُرجع رابطًا صالحًا للعرض في وسم img.
 */
export async function resolveTenantLogoUrl(logo?: string | null): Promise<string | null> {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo) || logo.startsWith("data:")) return logo;
  const { data, error } = await supabase.storage
    .from(TENANT_LOGOS_BUCKET)
    .createSignedUrl(logo, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** هوك جاهز لعرض شعار المقرأة داخل الواجهات */
export function useTenantLogo(logo?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void resolveTenantLogoUrl(logo).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [logo]);
  return url;
}
