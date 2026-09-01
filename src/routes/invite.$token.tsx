import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui-blocks";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/roles";
import { getInvitation, acceptInvitation } from "@/lib/invitations.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "دعوة للانضمام — سُحُب" },
      { name: "description", content: "اقبلي دعوتك للانضمام إلى مقرأة على منصة سُحُب وابدئي إدارة حلقاتك." },
      { property: "og:title", content: "دعوة للانضمام — سُحُب" },
      { property: "og:description", content: "دعوة للانضمام إلى مقرأة على منصة سُحُب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

const REASONS: Record<string, string> = {
  notfound: "رابط الدعوة غير صحيح.",
  used: "هذه الدعوة استُخدمت مسبقًا.",
  expired: "انتهت صلاحية هذه الدعوة، اطلبي دعوة جديدة.",
};

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const fetchInvite = useServerFn(getInvitation);
  const accept = useServerFn(acceptInvitation);

  const inviteQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvite({ data: { token } }),
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { token } }),
    onSuccess: async (res) => {
      toast.success("تم قبول الدعوة");
      await refresh();
      if (res.slug) navigate({ to: "/app/$slug", params: { slug: res.slug } });
      else navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر قبول الدعوة"),
  });

  const invite = inviteQuery.data;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16" dir="rtl">
      <div className="surface-panel w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </div>

        {inviteQuery.isLoading || loading ? (
          <LoadingBlock />
        ) : !invite?.ok ? (
          <>
            <h1 className="text-xl font-semibold">دعوة غير صالحة</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {REASONS[invite?.reason ?? "notfound"] ?? REASONS["notfound"]}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/">العودة للرئيسية</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">دعوة للانضمام إلى {invite.tenantName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              بصفة <span className="font-medium text-foreground">{ROLE_LABELS[invite.role] ?? invite.role}</span> —
              الدعوة مخصصة للبريد <span dir="ltr">{invite.email}</span>
            </p>

            {user ? (
              user.email?.toLowerCase() === invite.email.toLowerCase() ? (
                <Button
                  className="mt-6 w-full"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "قبول الدعوة"}
                </Button>
              ) : (
                <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  أنت مسجّلة الدخول ببريد مختلف (<span dir="ltr">{user.email}</span>). سجّلي الخروج ثم ادخلي بالبريد
                  المدعو.
                </p>
              )
            ) : (
              <>
                <p className="mt-6 text-sm text-muted-foreground">
                  سجّلي الدخول أو أنشئي حسابًا بنفس البريد أعلاه لقبول الدعوة.
                </p>
                <Button asChild className="mt-4 w-full">
                  <Link to="/auth" search={{ next: `/invite/${token}` }}>
                    الدخول / إنشاء حساب
                  </Link>
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
